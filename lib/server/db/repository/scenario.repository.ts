import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import type { LoadScenarioResult, ScenarioSummary, SaveScenarioInput } from "@/lib/shared/types/scenario.types";
import { DEFAULT_FLOORS } from "@/lib/shared/types/floor.types";
import { runInTx } from "@/lib/server/utils/runInTx";
import { floorRepository } from "@/lib/server/db/repository/floor.repository";
import { paintedCellRepository } from "@/lib/server/db/repository/paintedCell.repository";

/**
 * Scenario repository. Pure Prisma. Returns DTOs only; never exposes a
 * Prisma model instance across the use-case boundary.
 *
 * The factory accepts a `PrismaClient` or a `Prisma.TransactionClient`
 * (`tx`) so callers can compose multi-table writes in a transaction via
 * `runInTx`.
 */
export function scenarioRepository(db: PrismaClient | Prisma.TransactionClient) {
  return {
    /** List all scenarios as flat summaries. Counts are precomputed via
     *  Prisma's nested `_count` so the home page does not have to load the
     *  full floor + cell tree. */
    async findAllSummaries(): Promise<ScenarioSummary[]> {
      const rows = await db.scenario.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          floors: {
            select: {
              _count: { select: { paintedCells: true } },
            },
          },
        },
      });
      return rows.map((s) => {
        const paintedCellCount = s.floors.reduce(
          (sum, f) => sum + f._count.paintedCells,
          0,
        );
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
            orderBy: { order: "asc" },
            include: { paintedCells: true },
          },
        },
      });
      if (!scenario) return null;
      const plantaBaja = scenario.floors.find(
        (f) => f.name.toLowerCase() === "planta baja",
      );
      const initialFloor = plantaBaja ?? scenario.floors[0];
      if (!initialFloor) return null;
      return {
        id: scenario.id,
        name: scenario.name,
        floors: scenario.floors.map((f) => ({
          id: f.id,
          name: f.name,
          baseCellSize: f.baseCellSize,
          width: f.width,
          height: f.height,
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
              | LoadScenarioResult["paintedCells"][number]["entityState"]
              | undefined,
          })),
        ),
      };
    },

    /**
     * Upsert a scenario in a single transaction: existing floors are
     * deleted, the new floor set is bulk-inserted, painted cells are
     * bulk-inserted. Branches on `input.id` to update vs. create.
     */
    upsertInTx(tx: PrismaClient | Prisma.TransactionClient, input: SaveScenarioInput) {
      return runInTx(tx)(async (dbTx) => {
        const floorData = input.floors.map((f, i) => ({
          id: f.id,
          name: f.name,
          baseCellSize: f.baseCellSize,
          width: f.width,
          height: f.height,
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
            data: { name: input.name },
          });
          await floorRepository(dbTx).createManyInTx(dbTx, scenarioId, floorData);
          if (cellData.length > 0) {
            await paintedCellRepository(dbTx).createManyInTx(dbTx, cellData);
          }
          return scenario;
        }

        const created = await dbTx.scenario.create({
          data: { name: input.name },
        });
        await floorRepository(dbTx).createManyInTx(dbTx, created.id, floorData);
        if (cellData.length > 0) {
          await paintedCellRepository(dbTx).createManyInTx(dbTx, cellData);
        }
        return created;
      });
    },

    /**
     * Create the starter scenario with the default three floors used by
     * `createBlankScenario`. The floor payload comes from
     * `DEFAULT_FLOORS` so the defaults live in one place
     * (shared/types/floor.types) rather than being duplicated here.
     */
    async createBlank(scenarioId: string, floorIds: readonly string[]) {
      return db.scenario.create({
        data: {
          id: scenarioId,
          name: "Nuevo escenario",
          floors: {
            create: DEFAULT_FLOORS.map((f, i) => ({
              id: floorIds[i]!,
              name: f.name,
              baseCellSize: f.baseCellSize,
              width: f.width,
              height: f.height,
              order: i,
            })),
          },
        },
      });
    },
  };
}