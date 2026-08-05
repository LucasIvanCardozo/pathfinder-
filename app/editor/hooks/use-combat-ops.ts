'use client';

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Combatant, CombatantInsert, ScenarioEffect } from '@/lib/shared/types';
import { newId } from '@/lib/shared/utils/generateId';
import type { useCombatSession } from './use-combat-session';
import type { useOpsBuffer } from './use-ops-buffer';

type UseCombatOpsArgs = {
  scenarioId: string | null;
  combatSession: ReturnType<typeof useCombatSession>;
  opsBuffer: ReturnType<typeof useOpsBuffer>;
  /**
   * Setter for the optimistic `effects` state in the editor. `nextTurn` and
   * `advanceRound` age spells locally on round wrap / advance; the same setter
   * is used by `useSpellOps` so the local list stays consistent across the two
   * mutation surfaces.
   */
  setEffects: Dispatch<SetStateAction<ScenarioEffect[]>>;
  markDirty: () => void;
  closeCombatModal: () => void;
};

export type UseCombatOps = {
  startCombat: (combatants: CombatantInsert[]) => void;
  endCombat: () => void;
  nextTurn: () => void;
  previousTurn: () => void;
  advanceRound: () => void;
  addCombatant: (combatant: CombatantInsert) => void;
  removeCombatant: (combatantId: string) => void;
};

/**
 * Co-located with the only caller. Pure (deterministic) sort by initiative
 * descending, with `id` as the tie-breaker — the same rule the server uses
 * to canonicalise the initiative order before persisting.
 */
function sortCombatants(combatants: readonly Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Wraps the editor's combat mutation surface. Mirrors the ops the server's
 * `combat.repository` would apply, with optimistic local updates so the UI
 * feels instant. Round wrap detection in `nextTurn` mirrors the server's
 * `effectRepository.expireRoundInTx` rule so spell lifetimes age at the right
 * boundary (within a single round, N just moves the cursor and does NOT age
 * spells; on round wrap it does).
 */
export function useCombatOps({
  scenarioId,
  combatSession,
  opsBuffer,
  setEffects,
  markDirty,
  closeCombatModal,
}: UseCombatOpsArgs): UseCombatOps {
  const startCombat = useCallback(
    (combatants: CombatantInsert[]) => {
      // Assign ids locally so the GM can reference them from a spell's
      // `casterCombatantId` immediately — before the autosave persists
      // anything. The server honours these ids on insert (see
      // `combat.repository.createInTx`); the server falls back to a fresh
      // cuid for any wire without an id (legacy / future callers).
      const combatId = newId('combat');
      const localCombatants = sortCombatants(
        combatants.map((combatant) => ({
          ...combatant,
          id: newId('combatant'),
          combatId,
        })),
      );
      // Push the SAME ids down the wire so the server rows match the local
      // state. `pushStartCombat` accepts `CombatantInsert[]` — `id` is
      // optional in the schema to carry this through.
      opsBuffer.pushStartCombat(localCombatants);
      markDirty();
      combatSession.setCombat({
        id: combatId,
        scenarioId: scenarioId ?? 'pending-scenario',
        roundNumber: 1,
        currentTurnIndex: 0,
        combatants: localCombatants,
      });
    },
    [scenarioId, opsBuffer, markDirty, combatSession],
  );

  const endCombat = useCallback(() => {
    opsBuffer.pushEndCombat();
    markDirty();
    combatSession.setCombat(null);
    // Mirror `effectRepository.purgeOrphansInTx`: the endCombat cascade
    // deletes every effect row server-side, so the local list must drop
    // them too (same optimistic-UI pattern as `nextTurn`/`advanceRound`).
    // Without this, stale markers linger until the next `router.refresh()`.
    setEffects([]);
    closeCombatModal();
  }, [opsBuffer, markDirty, combatSession, setEffects, closeCombatModal]);

  const nextTurn = useCallback(() => {
    // Detect the round wrap before mutating combat state so we know whether
    // to optimistically tick `durationRounds`. A wrap happens when the
    // cursor advances past the last combatant back to the first — that is
    // the PF1e boundary at which spells age.
    const current = combatSession.combat;
    const wrapped =
      !!current &&
      current.combatants.length > 0 &&
      current.currentTurnIndex >= current.combatants.length - 1;
    opsBuffer.pushNextTurn();
    markDirty();
    combatSession.setCombat((cur) => {
      if (!cur || cur.combatants.length === 0) return cur;
      const combatants = sortCombatants(cur.combatants);
      const currentIndex = Math.min(cur.currentTurnIndex, combatants.length - 1);
      const nextIndex = currentIndex + 1;
      if (nextIndex >= combatants.length) {
        return { ...cur, combatants, currentTurnIndex: 0, roundNumber: cur.roundNumber + 1 };
      }
      return { ...cur, combatants, currentTurnIndex: nextIndex };
    });
    // Optimistic expiry on round wrap — same tick logic as the server's
    // `effectRepository.expireRoundInTx` (mirrors `advanceRound`'s branch).
    // Within a single round, N just moves the cursor and does NOT age spells.
    if (wrapped) {
      setEffects((prev) =>
        prev
          .map((e) => ({ ...e, durationRounds: e.durationRounds - 1 }))
          .filter((e) => e.durationRounds > 0),
      );
    }
  }, [combatSession, opsBuffer, markDirty, setEffects]);

  const previousTurn = useCallback(() => {
    opsBuffer.pushPreviousTurn();
    markDirty();
    combatSession.setCombat((current) => {
      if (!current || current.combatants.length === 0) return current;
      const combatants = sortCombatants(current.combatants);
      const currentIndex = Math.min(current.currentTurnIndex, combatants.length - 1);
      // Mirror the server's `previousTurnInTx` clamp at 0 (see
      // `combat.repository.ts::previousTurnInTx`). Wrapping backwards here
      // would diverge from the persisted cursor on the next autosave.
      const previousIndex = currentIndex === 0 ? 0 : currentIndex - 1;
      return { ...current, combatants, currentTurnIndex: previousIndex };
    });
  }, [combatSession, opsBuffer, markDirty]);

  const advanceRound = useCallback(() => {
    opsBuffer.pushAdvanceRound();
    markDirty();
    combatSession.setCombat((current) =>
      current
        ? { ...current, currentTurnIndex: 0, roundNumber: current.roundNumber + 1 }
        : current,
    );
    // Optimistic expiry — see comment in `nextTurn`.
    setEffects((prev) =>
      prev
        .map((e) => ({ ...e, durationRounds: e.durationRounds - 1 }))
        .filter((e) => e.durationRounds > 0),
    );
  }, [combatSession, opsBuffer, markDirty, setEffects]);

  const addCombatant = useCallback(
    (combatant: CombatantInsert) => {
      // Same id-propagation pattern as `startCombat`: assign the id
      // locally so the GM can reference it from a spell immediately,
      // and push the SAME id down the wire so the server row matches.
      // The server fills `combatId` from the live combat in `applyOp` —
      // the wire shape doesn't carry it.
      const id = combatant.id ?? newId('combatant');
      const added: Combatant = {
        ...combatant,
        id,
        combatId: '', // overwritten below with the live combat id
      };
      opsBuffer.pushAddCombatant({ ...combatant, id });
      markDirty();
      combatSession.setCombat((current) => {
        if (!current) return current;
        const stamped: Combatant = { ...added, combatId: current.id };
        const existing = sortCombatants(current.combatants);
        const currentIndex = Math.min(
          current.currentTurnIndex,
          Math.max(existing.length - 1, 0),
        );
        const currentId = existing[currentIndex]?.id;
        const nextCombatants = sortCombatants([...existing, stamped]);
        const nextIndex = currentId
          ? Math.max(0, nextCombatants.findIndex((item) => item.id === currentId))
          : 0;
        return { ...current, combatants: nextCombatants, currentTurnIndex: nextIndex };
      });
    },
    [combatSession, opsBuffer, markDirty],
  );

  const removeCombatant = useCallback(
    (combatantId: string) => {
      opsBuffer.pushRemoveCombatant(combatantId);
      markDirty();
      combatSession.setCombat((current) => {
        if (!current) return current;
        const existing = sortCombatants(current.combatants);
        const removedIndex = existing.findIndex((item) => item.id === combatantId);
        if (removedIndex < 0) return current;
        const currentIndex = Math.min(
          current.currentTurnIndex,
          Math.max(existing.length - 1, 0),
        );
        const nextCombatants = existing.filter((item) => item.id !== combatantId);
        const rebased = removedIndex <= currentIndex ? currentIndex - 1 : currentIndex;
        const nextIndex = Math.max(0, Math.min(rebased, Math.max(nextCombatants.length - 1, 0)));
        return { ...current, combatants: nextCombatants, currentTurnIndex: nextIndex };
      });
    },
    [combatSession, opsBuffer, markDirty],
  );

  return {
    startCombat,
    endCombat,
    nextTurn,
    previousTurn,
    advanceRound,
    addCombatant,
    removeCombatant,
  };
}
