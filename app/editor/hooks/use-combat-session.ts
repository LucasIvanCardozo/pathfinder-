'use client';

import { useEffect, useState } from 'react';
import type { CombatView } from '@/lib/shared/types';

/**
 * Client-side read model for the active scenario combat. Mutations stay in the
 * parent and arrive here through `setCombat`, while the prop sync keeps sibling
 * consumers such as `RoundViewer` aligned with refreshed server data.
 */
export function useCombatSession(initialCombat: CombatView | null) {
  const [combat, setCombat] = useState<CombatView | null>(initialCombat);

  useEffect(() => {
    setCombat(initialCombat);
  }, [initialCombat]);

  // The current combatant is the pointer into the canonical initiative order.
  const sortedCombatants = combat
    ? [...combat.combatants].sort((a, b) => {
        if (b.initiative !== a.initiative) return b.initiative - a.initiative;
        return a.id.localeCompare(b.id);
      })
    : [];
  const currentCombatant = sortedCombatants[combat?.currentTurnIndex ?? 0] ?? null;

  return {
    combat,
    currentCombatant,
    sortedCombatants,
    isActive: combat !== null,
    roundNumber: combat?.roundNumber ?? 0,
    turnIndex: combat?.currentTurnIndex ?? 0,
    setCombat,
  };
}
