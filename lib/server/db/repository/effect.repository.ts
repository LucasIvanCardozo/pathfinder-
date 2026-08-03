import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { EffectInput, ScenarioEffect } from '@/lib/shared/types';

/**
 * Repository for the `ScenarioEffect` table. Pure Prisma. Returns DTOs
 * only; never exposes a Prisma model instance across the use-case boundary.
 *
 * The factory accepts a `PrismaClient` or a `Prisma.TransactionClient` so
 * callers can compose multi-table writes in a transaction via `runInTx`.
 * The PR 1 surface covers read + bulk-create; PR 2 widens with the
 * per-floor find / relabel / dismiss helpers per design §5.2.
 */
export function effectRepository(db: PrismaClient | Prisma.TransactionClient) {
  return {
    /**
     * Return every effect for a scenario, ordered by `createdAt asc` so a
     * hard reload re-renders the markers in the same order they were placed.
     * The `scenarioId` index keeps this O(log n) for typical scenario sizes.
     */
    async findManyByScenarioId(scenarioId: string): Promise<ScenarioEffect[]> {
      const rows = await db.scenarioEffect.findMany({
        where: { scenarioId },
        orderBy: { createdAt: 'asc' },
      });
      return rows.map(toDto);
    },

    /**
     * Bulk-insert effects inside an open transaction. Used by `applyOpsInTx`
     * when seeding the first save. Skips silently when `rows` is empty so
     * callers don't need an extra guard. `scenarioId` is patched in by the
     * caller (the wire shape `EffectInput` doesn't carry it).
     */
    async createManyInTx(
      tx: Prisma.TransactionClient,
      scenarioId: string,
      rows: readonly EffectInput[],
    ): Promise<void> {
      if (rows.length === 0) return;
      await tx.scenarioEffect.createMany({
        data: rows.map(
          (r): Prisma.ScenarioEffectCreateManyInput => ({
            id: r.id,
            scenarioId,
            floorId: r.floorId,
            label: r.label,
            kind: r.kind,
            originCellX: r.originCellX,
            originCellY: r.originCellY,
            widthFt: r.widthFt,
            depthFt: r.depthFt,
            rotationDeg: r.rotationDeg,
            color: r.color,
            durationKind: r.durationKind,
            remainingRounds: r.remainingRounds,
            expired: r.expired,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }),
        ),
      });
    },

    /**
     * Decrement every non-expired effect's `remainingRounds` by one, then
     * flip `expired = true` on the rows that hit zero. Two `updateMany`
     * calls in this exact order — the second matches rows whose counter
     * was just decremented below zero (the `{ lte: 0 }` predicate is
     * inclusive of zero for effects already at zero).
     *
     * Called from `scenario.applyOp` on both the standalone `tickRound`
     * op and the implicit ticks triggered by `nextTurn` wrap / manual
     * `advanceRound`. Stays in the same TX so the marker expiry and the
     * combat cursor advance atomically.
     */
    async tickRoundInTx(tx: Prisma.TransactionClient, scenarioId: string): Promise<void> {
      await tx.scenarioEffect.updateMany({
        where: {
          scenarioId,
          expired: false,
          durationKind: { in: ['rounds', 'rounds-concentration'] },
        },
        data: { remainingRounds: { decrement: 1 } },
      });
      await tx.scenarioEffect.updateMany({
        where: { scenarioId, expired: false, remainingRounds: { lte: 0 } },
        data: { expired: true },
      });
    },
  };
}

/**
 * Strip Prisma-only fields (none today, but the indirection keeps the
 * boundary stable for future joins/selects) and shape into the DTO.
 */
function toDto(row: {
  id: string;
  scenarioId: string;
  floorId: string;
  label: string;
  kind: string;
  originCellX: number;
  originCellY: number;
  widthFt: number;
  depthFt: number;
  rotationDeg: number;
  color: string;
  durationKind: string;
  remainingRounds: number;
  expired: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ScenarioEffect {
  return {
    id: row.id,
    scenarioId: row.scenarioId,
    floorId: row.floorId,
    label: row.label,
    kind: row.kind as ScenarioEffect['kind'],
    originCellX: row.originCellX,
    originCellY: row.originCellY,
    widthFt: row.widthFt,
    depthFt: row.depthFt,
    rotationDeg: row.rotationDeg,
    color: row.color,
    durationKind: row.durationKind as ScenarioEffect['durationKind'],
    remainingRounds: row.remainingRounds,
    expired: row.expired,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
