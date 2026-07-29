import type { Prisma, PrismaClient } from '@/generated/prisma/client';

/**
 * Painted-cell repository. Provides the bulk-insert path used by the
 * scenario save flow and the count used by `subdivisionRepository.isInUse`
 * indirectly via `countBySubdivision`.
 */
export function paintedCellRepository(_db: PrismaClient | Prisma.TransactionClient) {
  return {
    /** Bulk-create painted cells inside an existing transaction. */
    async createManyInTx(
      tx: Prisma.TransactionClient,
      data: Array<{
        id: string;
        floorId: string;
        subdivisionId: string;
        gridX: number;
        gridY: number;
        pieceId: string;
        entityState: Prisma.InputJsonValue | typeof Prisma.JsonNull;
      }>,
    ): Promise<void> {
      await tx.paintedCell.createMany({ data });
    },

    /** How many painted cells reference the given subdivision id. */
    countBySubdivision(id: string): Promise<number> {
      return _db.paintedCell.count({ where: { subdivisionId: id } });
    },
  };
}
