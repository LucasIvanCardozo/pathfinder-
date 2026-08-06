'use server';

import { z } from 'zod';
import createAction from '@/lib/server/actions/createAction';
import { combatUseCases } from '@/lib/server/useCases/combat.usecases';

/**
 * Read-back Server Action for the combat tracker. Returns the current
 * `CombatView` (or null when no combat is active) for the given scenario.
 * Wrapped by `createAction` so callers get the canonical `ActionResult`
 * envelope; the handler is a single use-case call.
 *
 * This is a READ — no `updateTag` here. The mutation actions (`startCombat`,
 * `nextTurn`, etc.) live in `scenario.action.ts` as ops and call `updateTag`
 * from there after `applyOps` succeeds.
 */
export const readCombat = createAction(
  z.object({ scenarioId: z.string().min(1) }),
  async ({ data, db }) => combatUseCases(db).findByScenario(data.scenarioId),
);
