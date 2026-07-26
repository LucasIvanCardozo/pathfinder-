import { Prisma } from "@/generated/prisma/client";
import { cacheLife, cacheTag } from "next/cache";
import type { PrismaClient } from "@/generated/prisma/client";
import { scenarioRepository } from "@/lib/server/db/repository/scenario.repository";
import type { LoadScenarioResult, SaveScenarioInput, ScenarioSummary } from "@/lib/shared/types/scenario.types";
import { generateId } from "@/lib/shared/utils/generateId";

type TxOrClient = PrismaClient | Prisma.TransactionClient;

/**
 * Scenario use cases. Plain object of async methods, no classes, no
 * `'use server'`.
 *
 * Read methods import the singleton lazily inside the function body so the
 * cache key stays serialisable; writes accept the injected client so callers
 * can compose transactions.
 */
export const scenarioUseCases = {
  /** Cached list of all scenarios (flat summaries). */
  async list(): Promise<ScenarioSummary[]> {
    "use cache";
    cacheLife("hours");
    cacheTag("pathfinder:scenarios");
    const db = (await import("@/lib/server/db/db")).default;
    return scenarioRepository(db).findAllSummaries();
  },

  /** Cached full-scenario load. Returns null when the id is unknown. */
  async findById({ id }: { id: string }): Promise<LoadScenarioResult | null> {
    "use cache";
    cacheLife("hours");
    cacheTag("pathfinder:scenarios", `pathfinder:scenarios:${id}`);
    const db = (await import("@/lib/server/db/db")).default;
    return scenarioRepository(db).findByIdWithFloors(id);
  },

  /** Upsert a scenario. Returns the persisted id (newly-generated or existing). */
  async save(db: TxOrClient, input: SaveScenarioInput) {
    const scenario = await scenarioRepository(db).upsertInTx(db, input);
    return { id: scenario.id };
  },

  /**
   * Create a starter scenario with the default three floors (Subsuelo 1, Planta Baja, Piso 1). Used by the redirect-issuing
   * `createBlankScenario` action — the redirect signal would be lost if this
   * were wrapped in `createAction`.
   */
  async createBlank(db: TxOrClient) {
    const scenarioId = generateId("scenario");
    const floorIds = [generateId("floor"), generateId("floor"), generateId("floor")];
    await scenarioRepository(db).createBlank(scenarioId, floorIds);
    return { scenarioId, floorIds };
  },
};