import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { newId } from '@/lib/shared/utils/generateId';
import type { Combatant, CombatantInsert, CombatView } from '@/lib/shared/types/combat.types';

/**
 * Combat repository. Pure Prisma. Returns DTOs only; never exposes a Prisma
 * model instance across the use-case boundary.
 *
 * The factory accepts a `PrismaClient` or a `Prisma.TransactionClient` so
 * callers can compose multi-table writes in a transaction via `runInTx`. The
 * `*InTx` methods also accept a `tx` argument so the surrounding `applyOp`
 * replay can reuse its open transaction.
 *
 * Ordering rules (locked decisions):
 *   - Read side sorts combatants by `initiative desc`, `id asc` so ties go to
 *     the first-inserted combatant. The `position` column is best-effort and
 *     is NOT required to be gap-free.
 *   - `nextTurn` wraps past the last combatant → increments `roundNumber` and
 *     resets to 0; the caller is responsible for invoking
 *     `effectRepository(tx).tickRoundInTx` in the same TX on wrap.
 *   - `previousTurn` clamps at round 1 / turn 0 (asymmetric — rolling back
 *     from round 1 turn 0 stays put; it does NOT decrement `roundNumber`).
 */
export function combatRepository(db: PrismaClient | Prisma.TransactionClient) {
  return {
    /**
     * Find the active combat for a scenario, with all combatants in turn
     * order. Returns null if no combat is active. Combatants are ordered by
     * `initiative desc`, `id asc` so initiative ties resolve to the first
     * combatant inserted (cuids are time-ordered).
     */
    async findByScenario(scenarioId: string): Promise<CombatView | null> {
      const combat = await db.combat.findUnique({
        where: { scenarioId },
        include: {
          combatants: {
            orderBy: [{ initiative: 'desc' }, { id: 'asc' }],
          },
        },
      });
      if (!combat) return null;
      return toCombatView(combat, combat.combatants);
    },

    /**
     * Find combatants for a combat in initiative-desc / id-asc order. The
     * `tx` parameter is optional and overrides the closed-over `db` so the
     * `applyOp` replay can reuse its open transaction.
     */
    async findCombatantsInOrder(
      combatId: string,
      tx?: Prisma.TransactionClient,
    ): Promise<Combatant[]> {
      const client = tx ?? (db as Prisma.TransactionClient);
      const rows = await client.combatant.findMany({
        where: { combatId },
        orderBy: [{ initiative: 'desc' }, { id: 'asc' }],
      });
      return rows.map(toCombatantDto);
    },

    /**
     * Create a combat with initial combatants. The wire sends
     * `CombatantInsert[]`; we assign `position` 0, 1, 2, ... by `initiative`
     * desc then insertion order so the column matches the read order at
     * creation time (positions are best-effort thereafter).
     */
    async createInTx(
      tx: Prisma.TransactionClient,
      scenarioId: string,
      combatants: readonly CombatantInsert[],
    ): Promise<CombatView> {
      const combatId = newId('combat');
      // Insert combatants in wire order with sequential `position`s. Wire
      // order is already initiative-desc per the modal's UI; assigning
      // positions in that order keeps the column aligned with the read
      // ordering at start-of-combat. Re-sorting here would be wasted work.
      const created = await tx.combatant.createMany({
        data: combatants.map((c, i) => ({
          id: newId('combatant'),
          combatId,
          name: c.name,
          initiative: c.initiative,
          side: c.side,
          position: i,
        })),
      });
      // createMany doesn't return rows on Postgres; re-fetch to build the DTO.
      // The combat row itself comes from the create below so the include is
      // satisfied in one round-trip.
      const combat = await tx.combat.create({
        data: { id: combatId, scenarioId },
        include: {
          combatants: {
            orderBy: [{ initiative: 'desc' }, { id: 'asc' }],
          },
        },
      });
      // `created.count` is informational; the rows live on the included
      // `combat.combatants` and are mapped via `toCombatView`.
      void created;
      return toCombatView(combat, combat.combatants);
    },

    /**
     * Insert one combatant at the correct `position` based on `initiative`.
     * The read side ignores `position`, so we just append at the tail
     * (`position = current count`) — keeping the column monotonic without
     * paying for a per-row renumber on every mid-combat add.
     */
    async insertInTx(
      tx: Prisma.TransactionClient,
      combatId: string,
      input: CombatantInsert,
    ): Promise<Combatant> {
      const count = await tx.combatant.count({ where: { combatId } });
      const created = await tx.combatant.create({
        data: {
          id: newId('combatant'),
          combatId,
          name: input.name,
          initiative: input.initiative,
          side: input.side,
          position: count,
        },
      });
      return toCombatantDto(created);
    },

    /**
     * Remove a combatant by id. Cascade is not used (combatant has no
     * children); `position` is left gap-tolerant and the read side sorts by
     * `initiative` instead, so we never renumber.
     */
    async removeInTx(tx: Prisma.TransactionClient, combatantId: string): Promise<void> {
      await tx.combatant.deleteMany({ where: { id: combatantId } });
    },

    /**
     * Advance `currentTurnIndex` by +1. If it wraps past the last combatant,
     * increments `roundNumber` and resets to 0. The caller MUST invoke
     * `effectRepository(tx).tickRoundInTx(tx, scenarioId)` inside the same
     * TX on `wrapped === true` (locked decision — see design §11.5).
     */
    async nextTurnInTx(
      tx: Prisma.TransactionClient,
      combatId: string,
    ): Promise<{ wrapped: boolean; newRoundNumber: number }> {
      const combat = await tx.combat.findUnique({
        where: { id: combatId },
        select: { roundNumber: true, currentTurnIndex: true },
      });
      if (!combat) throw new Error(`nextTurnInTx: combat ${combatId} not found`);
      const combatants = await tx.combatant.findMany({
        where: { combatId },
        select: { id: true },
      });
      const lastIndex = combatants.length - 1;
      if (combat.currentTurnIndex >= lastIndex) {
        const newRoundNumber = combat.roundNumber + 1;
        await tx.combat.update({
          where: { id: combatId },
          data: { roundNumber: newRoundNumber, currentTurnIndex: 0 },
        });
        return { wrapped: true, newRoundNumber };
      }
      await tx.combat.update({
        where: { id: combatId },
        data: { currentTurnIndex: combat.currentTurnIndex + 1 },
      });
      return { wrapped: false, newRoundNumber: combat.roundNumber };
    },

    /**
     * Decrement `currentTurnIndex` by -1. Clamps at 0 instead of wrapping
     * backwards (asymmetric — rolling back from round 1 turn 0 stays put;
     * does NOT decrement `roundNumber`).
     */
    async previousTurnInTx(tx: Prisma.TransactionClient, combatId: string): Promise<void> {
      const combat = await tx.combat.findUnique({
        where: { id: combatId },
        select: { currentTurnIndex: true },
      });
      if (!combat) return;
      if (combat.currentTurnIndex <= 0) return;
      await tx.combat.update({
        where: { id: combatId },
        data: { currentTurnIndex: combat.currentTurnIndex - 1 },
      });
    },

    /**
     * Force-increment `roundNumber` and reset `currentTurnIndex` to 0. The
     * caller MUST invoke `effectRepository(tx).tickRoundInTx(tx, scenarioId)`
     * inside the same TX (locked decision — manual advance also ticks).
     */
    async advanceRoundInTx(tx: Prisma.TransactionClient, combatId: string): Promise<void> {
      const combat = await tx.combat.findUnique({
        where: { id: combatId },
        select: { roundNumber: true },
      });
      if (!combat) return;
      await tx.combat.update({
        where: { id: combatId },
        data: { roundNumber: combat.roundNumber + 1, currentTurnIndex: 0 },
      });
    },

    /**
     * Delete the combat and every combatant (cascade on the FK). Used by
     * the `endCombat` op; idempotent at the DB layer because the parent
     * op short-circuits when no combat exists.
     */
    async endInTx(tx: Prisma.TransactionClient, combatId: string): Promise<void> {
      await tx.combat.deleteMany({ where: { id: combatId } });
    },

    /** DTO mapper. Strip Prisma internals; keep combatants in input order. */
    toCombatView,
  };
}

/** Strip Prisma-only fields and shape into the `CombatView` DTO. */
function toCombatView(
  combat: { id: string; scenarioId: string; roundNumber: number; currentTurnIndex: number },
  combatants: Array<{ id: string; combatId: string; name: string; initiative: number; side: string }>,
): CombatView {
  return {
    id: combat.id,
    scenarioId: combat.scenarioId,
    roundNumber: combat.roundNumber,
    currentTurnIndex: combat.currentTurnIndex,
    combatants: combatants.map(toCombatantDto),
  };
}

/** Strip Prisma-only fields (notably `position` and `createdAt`/`updatedAt`)
 *  and shape into the `Combatant` DTO. */
function toCombatantDto(row: {
  id: string;
  combatId: string;
  name: string;
  initiative: number;
  side: string;
}): Combatant {
  return {
    id: row.id,
    combatId: row.combatId,
    name: row.name,
    initiative: row.initiative,
    side: row.side as Combatant['side'],
  };
}