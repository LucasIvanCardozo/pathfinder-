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
            originX: r.originX,
            originY: r.originY,
            widthM: r.widthM,
            depthM: r.depthM,
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
  originX: number;
  originY: number;
  widthM: number;
  depthM: number;
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
    originX: row.originX,
    originY: row.originY,
    widthM: row.widthM,
    depthM: row.depthM,
    rotationDeg: row.rotationDeg,
    color: row.color,
    durationKind: row.durationKind as ScenarioEffect['durationKind'],
    remainingRounds: row.remainingRounds,
    expired: row.expired,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
