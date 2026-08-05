import type { Prisma } from '@/generated/prisma/client';
import type { EffectInput } from '@/lib/shared/types/effect.types';

/**
 * Effect repository. Pure Prisma. Returns DTOs only; never exposes a Prisma
 * model instance across the use-case boundary.
 *
 * All mutators take an explicit `tx` argument so the surrounding `applyOps`
 * replay can reuse its open transaction. There is no factory-injected `db`
 * closure yet because every method takes `tx` — a read method would re-add
 * the `(db: PrismaClient | Prisma.TransactionClient)` factory parameter to
 * match the other entities.
 *
 * **Why this exists as its own layer.** Before the spellcasting refactor
 * (commit `dacd889`) `effect.repository.ts` lived next to scenario and
 * combat. The refactor merged effect mutations into the `ScenarioOp` replay
 * pipeline (single autosave TX) and dropped the file. The expiry logic and
 * orphan cleanup survived — but they leaked into `scenario.repository.ts`,
 * which broke the entity-file pattern and left stale doc comments in
 * `combat.repository.ts` referencing a non-existent `tickRoundInTx`. This
 * file is the canonical home for every `ScenarioEffect` mutation again;
 * `scenario.repository.applyOp` delegates here.
 *
 * **Cascade & ordering rules (locked decisions):**
 *   - `ScenarioEffect.casterCombatantId` is `onDelete: SetNull` — deleting a
 *     combatant does NOT cascade-delete its spells. The spells get a NULL
 *     caster and would otherwise render forever. `removeCombatant` op
 *     therefore calls `removeByCasterInTx` BEFORE `combatRepository.removeInTx`
 *     so the orphan rows are gone before the FK fires (no SetNull, no
 *     leftovers to purge).
 *   - `endCombat` cascades combatants away (FK `Combatant.combatId -> Combat.id`
 *     with `onDelete: Cascade`). All those combatant's spells get SetNull at
 *     that point. The op follows the cascade with `purgeOrphansInTx` to
 *     clean the now-null-caster rows.
 *   - `expireRoundInTx` runs in the same TX as the cursor advance that
 *     triggers it (PF1e rule: spells age on world-round boundaries). Caller
 *     decides when to call it (on `wrapped === true` for `nextTurn`, always
 *     for `advanceRound`). Reads in `findByIdWithFloors` never mutate.
 */
export function effectRepository() {
  return {
    /**
     * Insert one effect row. `scenarioId` is supplied by the caller (the
     * wrapping `applyOps` TX) so the same row shape survives a replay where
     * `op.scenarioId` is the result of a just-seeded `tx.scenario.create`.
     */
    async addInTx(
      tx: Prisma.TransactionClient,
      scenarioId: string,
      effect: EffectInput,
    ): Promise<void> {
      await tx.scenarioEffect.create({
        data: {
          id: effect.id,
          scenarioId,
          floorId: effect.floorId,
          templateId: effect.templateId,
          originCellX: effect.originCellX,
          originCellY: effect.originCellY,
          rotationDeg: effect.rotationDeg,
          durationRounds: effect.durationRounds,
          casterCombatantId: effect.casterCombatantId,
          castOnTurnIndex: effect.castOnTurnIndex,
          castOnRoundNumber: effect.castOnRoundNumber,
          createdAt: effect.createdAt,
          updatedAt: effect.updatedAt,
        },
      });
    },

    /** Remove an effect by id. Idempotent — matches zero rows after a
     *  successful remove. Mirrors `combat.repository.removeInTx`. */
    async removeInTx(tx: Prisma.TransactionClient, effectId: string): Promise<void> {
      await tx.scenarioEffect.deleteMany({ where: { id: effectId } });
    },

    /**
     * Pre-cascade cleanup: delete every effect whose `casterCombatantId`
     * matches the combatant that's about to be removed. Calling this BEFORE
     * `combatRepository.removeInTx` keeps the orphan rule clean — the FK
     * SetNull never has a row to fire on.
     */
    async removeByCasterInTx(
      tx: Prisma.TransactionClient,
      scenarioId: string,
      combatantId: string,
    ): Promise<void> {
      await tx.scenarioEffect.deleteMany({
        where: { scenarioId, casterCombatantId: combatantId },
      });
    },

    /**
     * Delete every effect in the scenario whose `casterCombatantId` is null.
     * Used after `endCombat`'s cascade leaves a wave of orphan rows behind.
     * Idempotent (zero rows match a scenario with no orphans).
     */
    async purgeOrphansInTx(
      tx: Prisma.TransactionClient,
      scenarioId: string,
    ): Promise<void> {
      await tx.scenarioEffect.deleteMany({
        where: { scenarioId, casterCombatantId: null },
      });
    },

    /**
     * PF1e spell expiry in world rounds: decrement `durationRounds` on every
     * row with a positive counter, then delete the rows that hit zero in the
     * same TX. Two queries so the read side never serves a row with a
     * non-positive counter (the marker either lives or it doesn't; no
     * "ticking down" intermediate state).
     */
    async expireRoundInTx(
      tx: Prisma.TransactionClient,
      scenarioId: string,
    ): Promise<void> {
      await tx.scenarioEffect.updateMany({
        where: { scenarioId, durationRounds: { gt: 0 } },
        data: { durationRounds: { decrement: 1 } },
      });
      await tx.scenarioEffect.deleteMany({
        where: { scenarioId, durationRounds: { lte: 0 } },
      });
    },
  };
}