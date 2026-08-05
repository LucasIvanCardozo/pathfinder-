'use client';

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EffectInput, ScenarioEffect } from '@/lib/shared/types';
import type { useOpsBuffer } from './use-ops-buffer';

type UseSpellOpsArgs = {
  scenarioId: string | null;
  opsBuffer: ReturnType<typeof useOpsBuffer>;
  /**
   * Local effects state setter — the hook mirrors the persisted row so the
   * marker renders on the next paint frame (optimistic UI).
   */
  setEffects: Dispatch<SetStateAction<ScenarioEffect[]>>;
  markDirty: () => void;
};

export type UseSpellOps = {
  pushAddEffect: (effect: EffectInput) => void;
};

/**
 * PR 2 of the spellcasting refactor: spell wire. Pushes go through the
 * existing ops buffer + autosave; the local `effects` state mirrors the
 * persisted row so the marker renders on the next paint frame (optimistic UI).
 * The cast snapshot (casterCombatantId + castOnTurnIndex + castOnRoundNumber)
 * drives the server-side expiry rule.
 *
 * Spells are NOT manually removable: the only way for a marker to
 * disappear is the `endCombat` cascade (which sweeps all effects via
 * `effectRepository.purgeOrphansInTx`) or the per-round tick that
 * decrements `durationRounds` and deletes the row at zero.
 */
export function useSpellOps({
  scenarioId,
  opsBuffer,
  setEffects,
  markDirty,
}: UseSpellOpsArgs): UseSpellOps {
  const pushAddEffect = useCallback(
    (effect: EffectInput) => {
      opsBuffer.pushAddEffect(effect);
      markDirty();
      setEffects((prev) => [...prev, { ...effect, scenarioId: scenarioId ?? '' }]);
    },
    [opsBuffer, markDirty, setEffects, scenarioId],
  );

  return { pushAddEffect };
}
