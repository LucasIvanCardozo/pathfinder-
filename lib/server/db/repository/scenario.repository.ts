import type { PrismaClient } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import { combatRepository } from '@/lib/server/db/repository/combat.repository';
import { floorRepository } from '@/lib/server/db/repository/floor.repository';
import { paintedCellRepository } from '@/lib/server/db/repository/paintedCell.repository';
import { runInTx } from '@/lib/server/utils/runInTx';
import type { ScenarioOp, ScenarioSaveRequest } from '@/lib/shared/types';
import type { SaveScenarioInput } from '@/lib/shared/types/scenario.types';
import type { ScenarioEffect } from '@/lib/shared/types/effect.types';
import { isPlantaBajaName } from '@/lib/shared/floors/naming';
import { DEFAULT_FLOORS } from '@/lib/shared/types/floor.types';
import type {
  LoadScenarioResult,
  ScenarioSummary,
} from '@/lib/shared/types/scenario.types';

/**
 * Scenario repository. Pure Prisma. Returns DTOs only; never exposes a
 * Prisma model instance across the use-case boundary.
 *
 * The factory accepts a `PrismaClient` or a `Prisma.TransactionClient`
 * (`tx`) so callers can compose multi-table writes in a transaction via
 * `runInTx`.
 *
 * Map dimensions (`baseCellSize`, `width`, `height`) live on the scenario
 * and are shared by every floor.
 */
export function scenarioRepository(db: PrismaClient | Prisma.TransactionClient) {
  return {
    /** List all scenarios as flat summaries. Counts are precomputed via
     *  Prisma's nested `_count` so the home page does not have to load the
     *  full floor + cell tree. */
    async findAllSummaries(): Promise<ScenarioSummary[]> {
      const rows = await db.scenario.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          floors: {
            select: {
              _count: { select: { paintedCells: true } },
            },
          },
        },
      });
      return rows.map((s) => {
        const paintedCellCount = s.floors.reduce((sum, f) => sum + f._count.paintedCells, 0);
        return {
          id: s.id,
          name: s.name,
          floorCount: s.floors.length,
          paintedCellCount,
          updatedAt: s.updatedAt,
        };
      });
    },

    /** Load a full scenario as a `LoadScenarioResult`. Returns null when the
     *  id is unknown. The active floor defaults to "Planta Baja" with a
     *  fallback to the lowest-ordered floor for legacy scenarios that don't
     *  follow the naming convention. */
    async findByIdWithFloors(id: string): Promise<LoadScenarioResult | null> {
      const scenario = await db.scenario.findUnique({
        where: { id },
        include: {
          floors: {
            orderBy: { order: 'asc' },
            include: { paintedCells: true },
          },
            effects: true,
        },
      });
      if (!scenario) return null;
      const plantaBaja = scenario.floors.find((f) => isPlantaBajaName(f.name));
      const initialFloor = plantaBaja ?? scenario.floors[0];
      if (!initialFloor) return null;
      const combat = await combatRepository(db).findByScenario(id);
      return {
        id: scenario.id,
        name: scenario.name,
        baseCellSize: scenario.baseCellSize,
        width: scenario.width,
        height: scenario.height,
        floors: scenario.floors.map((f) => ({
          id: f.id,
          name: f.name,
        })),
        activeFloorId: initialFloor.id,
        paintedCells: scenario.floors.flatMap((f) =>
          f.paintedCells.map((c) => ({
            id: c.id,
            floorId: c.floorId,
            subdivisionId: c.subdivisionId,
            gridX: c.gridX,
            gridY: c.gridY,
            pieceId: c.pieceId,
            // Prisma returns JsonValue | null for nullable Json columns;
            // collapse null to undefined and trust the shape from the client.
            entityState: (c.entityState ?? undefined) as
              | LoadScenarioResult['paintedCells'][number]['entityState']
              | undefined,
          })),
        ),
        effects: scenario.effects as Array<ScenarioEffect>,
        combat,
      };
    },

    /**
     * Upsert a scenario in a single transaction: existing floors are
     * deleted, the new floor set is bulk-inserted, painted cells are
     * bulk-inserted. Branches on `input.id` to update vs. create. Map
     * dimensions are persisted on the scenario row.
     *
     * Kept for the legacy `saveScenario` action. New code should use
     * `applyOpsInTx` which is a fraction of the cost for incremental saves.
     */
    upsertInTx(tx: PrismaClient | Prisma.TransactionClient, input: SaveScenarioInput) {
      return runInTx(tx)(async (dbTx) => {
        const floorData = input.floors.map((f, i) => ({
          id: f.id,
          name: f.name,
          order: i,
        }));
        const cellData = input.paintedCells.map((cell) => ({
          id: cell.id,
          floorId: cell.floorId,
          subdivisionId: cell.subdivisionId,
          gridX: cell.gridX,
          gridY: cell.gridY,
          pieceId: cell.pieceId,
          // Prisma's nullable Json column accepts the literal JsonNull
          // sentinel for an explicit SQL NULL — do not stringify undefined.
          entityState: (cell.entityState ?? Prisma.JsonNull) as
            | Prisma.InputJsonValue
            | typeof Prisma.JsonNull,
        }));

        if (input.id) {
          const scenarioId = input.id;
          await floorRepository(dbTx).deleteManyByScenarioInTx(dbTx, scenarioId);
          const scenario = await dbTx.scenario.update({
            where: { id: scenarioId },
            data: {
              name: input.name,
              baseCellSize: input.baseCellSize,
              width: input.width,
              height: input.height,
            },
          });
          await floorRepository(dbTx).createManyInTx(dbTx, scenarioId, floorData);
          if (cellData.length > 0) {
            await paintedCellRepository(dbTx).createManyInTx(dbTx, cellData);
          }
          return scenario;
        }

        const created = await dbTx.scenario.create({
          data: {
            name: input.name,
            baseCellSize: input.baseCellSize,
            width: input.width,
            height: input.height,
          },
        });
        await floorRepository(dbTx).createManyInTx(dbTx, created.id, floorData);
        if (cellData.length > 0) {
          await paintedCellRepository(dbTx).createManyInTx(dbTx, cellData);
        }
        return created;
      });
    },

    /**
     * Apply a batch of `ScenarioOp`s to an existing scenario inside one
     * transaction. Each op is small and targeted, so the TX stays under
     * Prisma's 5 s timeout for any realistic batch — the previous
     * "delete everything + re-insert" path was the real source of the
     * timeout. Ops run in array order (paint then erase on the same id
     * → erased; erase then paint → created). On first save
     * (`scenarioId === null`) the `initialState` payload seeds the
     * scenario and ops replay on top.
     */
    async applyOpsInTx(request: ScenarioSaveRequest) {
      return runInTx(db)(async (tx) => {
        let scenarioId: string;

        if (request.scenarioId === null) {
          if (!request.initialState) {
            throw new Error('applyOpsInTx: scenarioId === null requires initialState');
          }
          // Seed: create scenario + floors + bulk-insert cells, then replay
          // any ops the client already accumulated against the (empty)
          // initial state. This mirrors what `upsertInTx` did for the first
          // save but with the new op-based path so the client can stay
          // op-buffer-shaped even on first save.
          const created = await tx.scenario.create({
            data: {
              name: request.initialState.name,
              baseCellSize: request.initialState.baseCellSize,
              width: request.initialState.width,
              height: request.initialState.height,
              floors: {
                create: request.initialState.floors.map((f, i) => ({
                  id: f.id,
                  name: f.name,
                  order: i,
                })),
              },
            },
          });
          scenarioId = created.id;

          const initialCells = request.initialState.paintedCells.map((c) => ({
            id: c.id,
            floorId: c.floorId,
            subdivisionId: c.subdivisionId,
            gridX: c.gridX,
            gridY: c.gridY,
            pieceId: c.pieceId,
            entityState: (c.entityState ?? Prisma.JsonNull) as
              | Prisma.InputJsonValue
              | typeof Prisma.JsonNull,
          }));
          if (initialCells.length > 0) {
            await paintedCellRepository(tx).createManyInTx(tx, initialCells);
          }
        } else {
          scenarioId = request.scenarioId;
          // Light existence check so the caller gets a clean 404-style error
          // instead of a Prisma foreign-key violation mid-replay.
          const exists = await tx.scenario.findUnique({
            where: { id: scenarioId },
            select: { id: true },
          });
          if (!exists) {
            throw new Error(`applyOpsInTx: scenario ${scenarioId} not found`);
          }
        }

        for (const op of request.ops) {
          await applyOp(tx, scenarioId, op);
        }

        // Bump `updatedAt` so the next save's `baselineVersion` can be
        // compared. Returning the new value lets the client capture it for
        // the next round.
        const updated = await tx.scenario.update({
          where: { id: scenarioId },
          data: { updatedAt: new Date() },
          select: { id: true, updatedAt: true },
        });
        return { id: updated.id, updatedAt: updated.updatedAt };
      });
    },

    /**
     * Create the starter scenario with the default three floors used by
     * `createBlankScenario`. Map dimensions come from `input` so the
     * scenario-level constants drive both the new scenario row and the
     * default floors (which inherit them).
     */
    async createBlank(
      scenarioId: string,
      floorIds: readonly string[],
      mapDims: { baseCellSize: number; width: number; height: number },
    ) {
      return db.scenario.create({
        data: {
          id: scenarioId,
          name: 'Nuevo escenario',
          baseCellSize: mapDims.baseCellSize,
          width: mapDims.width,
          height: mapDims.height,
          floors: {
            create: DEFAULT_FLOORS.map((f, i) => ({
              id: floorIds[i]!,
              name: f.name,
              order: i,
            })),
          },
        },
      });
    },
  };
}

/**
 * Replay one op against an open transaction. Throws on unknown ids or
 * constraint violations — the surrounding `runInTx` rolls back the whole
 * batch so the scenario never lands in a half-applied state.
 */
async function applyOp(
  tx: Prisma.TransactionClient,
  scenarioId: string,
  op: ScenarioOp,
): Promise<void> {
  switch (op.type) {
    case 'paintCells': {
      if (op.cells.length === 0) return;
      // Batch upsert: 1 SELECT to detect existing ids, 1 createMany for
      // the new rows, N updates for the replaces. Replaces are typically a
      // minority of the cells in a stroke (most paints are over empty
      // cells or paint the same piece), so this avoids the N-times-SELECT
      // pattern of the previous per-cell `upsert`. For 10k+ cells this
      // drops server time from ~5 s to <500 ms (memory observation
      // "pathfinder-batch-upsert"; tracked in PR #10362 upstream).
      const ids = op.cells.map((c) => c.id);
      const existing = await tx.paintedCell.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((e) => e.id));
      const newCells = op.cells.filter((c) => !existingIds.has(c.id));
      const replacedCells = op.cells.filter((c) => existingIds.has(c.id));

      if (newCells.length > 0) {
        await tx.paintedCell.createMany({
          data: newCells.map((c) => ({
            id: c.id,
            floorId: op.floorId,
            subdivisionId: op.subdivisionId,
            gridX: c.gridX,
            gridY: c.gridY,
            pieceId: c.pieceId,
            entityState: (c.entityState ?? Prisma.JsonNull) as
              | Prisma.InputJsonValue
              | typeof Prisma.JsonNull,
          })),
        });
      }
      // Replaces stay per-row because pieceId / entityState may differ
      // per cell. A future optimisation could collapse strokes that share
      // pieceId + entityState into a single `updateMany`.
      for (const cell of replacedCells) {
        await tx.paintedCell.update({
          where: { id: cell.id },
          data: {
            pieceId: cell.pieceId,
            entityState: (cell.entityState ?? Prisma.JsonNull) as
              | Prisma.InputJsonValue
              | typeof Prisma.JsonNull,
          },
        });
      }
      return;
    }
    case 'eraseCells': {
      await tx.paintedCell.deleteMany({ where: { id: { in: op.cellIds } } });
      return;
    }
    case 'setEntityState': {
      await tx.paintedCell.update({
        where: { id: op.cellId },
        data: {
          entityState: op.entityState === null
            ? Prisma.JsonNull
            : (op.entityState as Prisma.InputJsonValue),
        },
      });
      return;
    }
    case 'clearAllCells': {
      await tx.paintedCell.deleteMany({
        where: { floor: { scenarioId } },
      });
      return;
    }
    case 'clearFloor': {
      await tx.paintedCell.deleteMany({
        where: { floorId: op.floorId },
      });
      return;
    }
    case 'clearSubdivision': {
      await tx.paintedCell.deleteMany({
        where: {
          floorId: op.floorId,
          subdivisionId: op.subdivisionId,
        },
      });
      return;
    }
    case 'addFloor': {
      // Compute `order` so the new floor lands at the top or bottom of the
      // stack. Read current max/min in the same TX to stay race-free.
      if (op.position === 'above') {
        const max = await tx.floor.aggregate({
          where: { scenarioId },
          _max: { order: true },
        });
        await tx.floor.create({
          data: {
            id: op.floor.id,
            scenarioId,
            name: op.floor.name,
            order: (max._max.order ?? -1) + 1,
          },
        });
      } else {
        const min = await tx.floor.aggregate({
          where: { scenarioId },
          _min: { order: true },
        });
        await tx.floor.create({
          data: {
            id: op.floor.id,
            scenarioId,
            name: op.floor.name,
            order: (min._min.order ?? 0) - 1,
          },
        });
        // Shift existing floors down by one so the new one is index 0.
        await tx.floor.updateMany({
          where: { scenarioId, id: { not: op.floor.id } },
          data: { order: { increment: 1 } },
        });
      }
      return;
    }
    case 'setScenarioName': {
      await tx.scenario.update({
        where: { id: scenarioId },
        data: { name: op.name },
      });
      return;
    }
    case 'addEffect': {
      // Spellcasting refactor (PR 1): the wire shape collapsed to
      // templateId + origin + rotation + caster snapshot. The columns
      // that used to be user-editable (label, kind, widthFt, color,
      // durationKind, remainingRounds, expired) are now derived from
      // the template at render time.
      await tx.scenarioEffect.create({
        data: {
          id: op.effect.id,
          scenarioId,
          floorId: op.effect.floorId,
          templateId: op.effect.templateId,
          originCellX: op.effect.originCellX,
          originCellY: op.effect.originCellY,
          rotationDeg: op.effect.rotationDeg,
          casterCombatantId: op.effect.casterCombatantId,
          castOnTurnIndex: op.effect.castOnTurnIndex,
          castOnRoundNumber: op.effect.castOnRoundNumber,
          createdAt: op.effect.createdAt,
          updatedAt: op.effect.updatedAt,
        },
      });
      return;
    }
    case 'removeEffect': {
      // Idempotent — a stale op replayed after a successful removal is a
      // no-op, not an error.
      await tx.scenarioEffect.deleteMany({ where: { id: op.effectId } });
      return;
    }
    case 'startCombat': {
      // Idempotent on replay: a stale op against an existing combat
      // would violate the `Combat.scenarioId` unique constraint, so
      // short-circuit when a combat already exists for the scenario.
      // The client only emits this op once per "Iniciar combate" click.
      const existing = await tx.combat.findUnique({
        where: { scenarioId },
        select: { id: true },
      });
      if (existing) return;
      await combatRepository(tx).createInTx(tx, scenarioId, op.combatants);
      return;
    }
    case 'endCombat': {
      // Idempotent — replaying endCombat after a successful end is a
      // no-op. The cascade delete drops every Combatant row along with
      // the Combat row (locked decision: no soft archive).
      const combat = await tx.combat.findUnique({
        where: { scenarioId },
        select: { id: true },
      });
      if (!combat) return;
      await combatRepository(tx).endInTx(tx, combat.id);
      return;
    }
    case 'nextTurn': {
      // Spell expiry lives here (PR 1 of the spellcasting refactor):
      // when the cursor lands on a caster whose spells were cast in a
      // prior round, those spells die in the same TX as the cursor
      // advance. Asymmetric — `previousTurn` does NOT re-resurrect or
      // re-expire anything.
      const combat = await tx.combat.findUnique({
        where: { scenarioId },
        select: { id: true, roundNumber: true, currentTurnIndex: true },
      });
      if (!combat) return;
      const { newRoundNumber } = await combatRepository(tx).nextTurnInTx(tx, combat.id);
      const currentCasterId = await currentCasterCombatantId(
        tx,
        combat.id,
        combat.currentTurnIndex,
      );
      if (currentCasterId) {
        await tx.scenarioEffect.deleteMany({
          where: {
            scenarioId,
            casterCombatantId: currentCasterId,
            castOnRoundNumber: { lt: newRoundNumber },
          },
        });
      }
      return;
    }
    case 'previousTurn': {
      // Asymmetric — clamping at round 1 turn 0 is enforced inside the
      // repository (no decrement of `roundNumber` on the rollback path).
      const combat = await tx.combat.findUnique({
        where: { scenarioId },
        select: { id: true },
      });
      if (!combat) return;
      await combatRepository(tx).previousTurnInTx(tx, combat.id);
      return;
    }
    case 'advanceRound': {
      // Manual round advance kills the new cursor's prior-round spells
      // (same rule as `nextTurn` when the cursor wraps to a fresh
      // round).
      const combat = await tx.combat.findUnique({
        where: { scenarioId },
        select: { id: true, roundNumber: true },
      });
      if (!combat) return;
      await combatRepository(tx).advanceRoundInTx(tx, combat.id);
      const newRoundNumber = combat.roundNumber + 1;
      const currentCasterId = await currentCasterCombatantId(tx, combat.id, 0);
      if (currentCasterId) {
        await tx.scenarioEffect.deleteMany({
          where: {
            scenarioId,
            casterCombatantId: currentCasterId,
            castOnRoundNumber: { lt: newRoundNumber },
          },
        });
      }
      return;
    }
    case 'addCombatant': {
      // Inserts at the correct initiative-sorted position. The
      // repository computes the position based on the current count;
      // the read side ignores `position` and sorts by `initiative`.
      const combat = await tx.combat.findUnique({
        where: { scenarioId },
        select: { id: true },
      });
      if (!combat) return;
      await combatRepository(tx).insertInTx(tx, combat.id, op.combatant);
      return;
    }
    case 'removeCombatant': {
      // Idempotent — the `deleteMany` matches zero rows after a
      // successful prior remove. Mirrors `removeEffect` semantics.
      await combatRepository(tx).removeInTx(tx, op.combatantId);
      return;
    }
    default: {
      const _exhaustive: never = op;
      throw new Error(`applyOp: unknown op type`);
    }
  }
}

/**
 * Resolve the id of the combatant at the given cursor position (initiative
 * desc, id asc — the canonical read order). Returns `null` when the combat
 * has no combatants; callers gate the expiry delete on a non-null result so
 * the empty-combat case is a safe no-op.
 */
async function currentCasterCombatantId(
  tx: Prisma.TransactionClient,
  combatId: string,
  turnIndex: number,
): Promise<string | null> {
  const combatants = await tx.combatant.findMany({
    where: { combatId },
    orderBy: [{ initiative: 'desc' }, { id: 'asc' }],
    select: { id: true },
  });
  return combatants[turnIndex]?.id ?? null;
}
