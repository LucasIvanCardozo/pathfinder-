import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { runInTx } from '@/lib/server/utils/runInTx';
import type {
  SubdivisionConfig,
  SubdivisionConfigInput,
} from '@/lib/shared/types/subdivision.types';

/**
 * Subdivision repository. Pieces are NOT scoped to a subdivision, so the
 * repository doesn't need to validate or transform any piece-id list. The
 * CRUD here is a thin pass-through to Prisma plus the reorder transaction.
 */
export function subdivisionRepository(db: PrismaClient | Prisma.TransactionClient) {
  function rowToConfig(row: {
    id: string;
    name: string;
    cellSizeRatio: number;
    order: number;
  }): SubdivisionConfig {
    return {
      id: row.id,
      name: row.name,
      cellSizeRatio: row.cellSizeRatio,
      order: row.order,
    };
  }

  function payloadToRow(input: SubdivisionConfigInput) {
    return {
      name: input.name,
      cellSizeRatio: input.cellSizeRatio,
      order: input.order,
    };
  }

  return {
    /** All subdivisions ordered for the manager UI. */
    async findAllOrdered(): Promise<SubdivisionConfig[]> {
      const rows = await db.subdivisionConfig.findMany({
        orderBy: { order: 'asc' },
      });
      return rows.map(rowToConfig);
    },

    async findById(id: string): Promise<SubdivisionConfig | null> {
      const row = await db.subdivisionConfig.findUnique({ where: { id } });
      return row ? rowToConfig(row) : null;
    },

    async create(input: SubdivisionConfigInput): Promise<SubdivisionConfig> {
      const created = await db.subdivisionConfig.create({ data: payloadToRow(input) });
      return rowToConfig(created);
    },

    async update(id: string, input: SubdivisionConfigInput): Promise<SubdivisionConfig> {
      const updated = await db.subdivisionConfig.update({
        where: { id },
        data: payloadToRow(input),
      });
      return rowToConfig(updated);
    },

    async delete(id: string): Promise<void> {
      await db.subdivisionConfig.delete({ where: { id } });
    },

    /**
     * Used by the delete use case to refuse deletion when a subdivision is
     * still referenced by painted cells. Keeps the join detail hidden from
     * the use case.
     */
    async isInUse(id: string): Promise<boolean> {
      const count = await db.paintedCell.count({ where: { subdivisionId: id } });
      return count > 0;
    },

    /**
     * Apply a batch of `{id, order}` updates inside a single transaction so
     * the reordering is atomic. The caller is responsible for validating the
     * input shape.
     */
    async reorderInTx(
      tx: PrismaClient | Prisma.TransactionClient,
      orders: { id: string; order: number }[],
    ): Promise<void> {
      await runInTx(tx)(async (dbTx) => {
        await Promise.all(
          orders.map((o) =>
            dbTx.subdivisionConfig.update({
              where: { id: o.id },
              data: { order: o.order },
            }),
          ),
        );
      });
    },
  };
}
