import { cacheLife, cacheTag } from 'next/cache';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { scenarioRepository } from '@/lib/server/db/repository/scenario.repository';
import type { ScenarioOp, ScenarioSaveRequest } from '@/lib/shared/types';
import type {
  LoadScenarioResult,
  SaveScenarioInput,
  ScenarioSummary,
} from '@/lib/shared/types/scenario.types';
import { newId } from '@/lib/shared/utils/generateId';

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
    'use cache';
    cacheLife('hours');
    cacheTag('pathfinder:scenarios');
    const db = (await import('@/lib/server/db/db')).default;
    return scenarioRepository(db).findAllSummaries();
  },

  /** Cached full-scenario load. Returns null when the id is unknown. */
  async findById({ id }: { id: string }): Promise<LoadScenarioResult | null> {
    'use cache';
    cacheLife('hours');
    cacheTag('pathfinder:scenarios', `pathfinder:scenario:${id}`);
    const db = (await import('@/lib/server/db/db')).default;
    return scenarioRepository(db).findByIdWithFloors(id);
  },

  /** Upsert a scenario. Returns the persisted id (newly-generated or existing).
   *
   *  Legacy full-state path. New callers should use `applyOps` (op-based
   *  saves) — the payload is a fraction of the size and the TX finishes
   *  in milliseconds instead of seconds. */
  async save(db: TxOrClient, input: SaveScenarioInput) {
    const scenario = await scenarioRepository(db).upsertInTx(db, input);
    return { id: scenario.id };
  },

  /**
   * Apply a batch of `ScenarioOp`s to a scenario. Returns the persisted id
   * and the bumped `updatedAt` (used as the next round's `baselineVersion`).
   * Replaces the legacy "delete everything + re-insert" upsert with small
   * targeted Prisma operations inside one TX, dropping the payload size
   * from O(cells) to O(changes-since-last-save).
   */
  async applyOps(db: TxOrClient, request: ScenarioSaveRequest) {
    return scenarioRepository(db).applyOpsInTx(request);
  },

  /**
   * Create a starter scenario with the default three floors (Subsuelo 1,
   * Planta Baja, Piso 1) and the caller-supplied map dimensions. Used by
   * the redirect-issuing `createBlankScenario` action — `createAction`
   * would swallow the redirect signal.
   */
  async createBlank(
    db: TxOrClient,
    mapDims: { baseCellSize: number; width: number; height: number },
  ) {
    const scenarioId = newId('scenario');
    const floorIds = [newId('floor'), newId('floor'), newId('floor')];
    await scenarioRepository(db).createBlank(scenarioId, floorIds, mapDims);
    return { scenarioId };
  },
};

// Re-export the op type so callers don't have to import from `@/lib/shared/types`
// separately when they only need this one.
export type { ScenarioOp, ScenarioSaveRequest };
