import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Floor } from "@/lib/shared/types/floor.types";

/**
 * Thin floor repository. Lives in its own file so transactional reads
 * (scenario save: deleteManyByScenarioInTx) and bulk writes can compose
 * without growing the scenario repository.
 */
export function floorRepository(_db: PrismaClient | Prisma.TransactionClient) {
  return {
    /** Delete every floor for a scenario inside an existing transaction. */
    deleteManyByScenarioInTx(tx: Prisma.TransactionClient, scenarioId: string) {
      return tx.floor.deleteMany({ where: { scenarioId } });
    },

    /**
     * Bulk-create floors inside an existing transaction. The caller supplies
     * the parent `scenarioId` because `createMany` does not support nested
     * create under a parent.
     */
    async createManyInTx(
      tx: Prisma.TransactionClient,
      scenarioId: string,
      data: Array<{
        id: string;
        name: string;
        baseCellSize: number;
        width: number;
        height: number;
        order: number;
      }>,
    ): Promise<Floor[]> {
      await tx.floor.createMany({
        data: data.map((f) => ({ ...f, scenarioId })),
      });
      return data.map((f) => ({
        id: f.id,
        name: f.name,
        baseCellSize: f.baseCellSize,
        width: f.width,
        height: f.height,
      }));
    },
  };
}