import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { combatRepository } from '@/lib/server/db/repository/combat.repository';
import type { CombatView } from '@/lib/shared/types/combat.types';

type TxOrClient = PrismaClient | Prisma.TransactionClient;

/**
 * Combat use cases. Factory that accepts the injected Prisma client so the
 * caller (action layer) controls whether the read runs standalone or inside
 * an open transaction.
 *
 * Read surface is intentionally thin — Batch 3 (UI) introduces the
 * `useCombatSession` cache wrapper around `findByScenario`. The use case
 * itself stays uncached so the wrapper owns the cache directives and tags.
 */
export function combatUseCases(db: TxOrClient) {
  return {
    /**
     * Read-only fetch for the editor. Returns null when no combat is active.
     * `useCombatSession` (Batch 3) wraps this in `'use cache'` +
     * `cacheTag('pathfinder:combat:${scenarioId}')` and calls
     * `updateTag(...)` from the mutation actions to invalidate.
     */
    async findByScenario(scenarioId: string): Promise<CombatView | null> {
      return combatRepository(db).findByScenario(scenarioId);
    },
  };
}