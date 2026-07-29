'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import createAction from '@/lib/server/actions/createAction';
import { scenarioUseCases } from '@/lib/server/useCases';
import { DEFAULT_MAP_DIMS } from '@/lib/shared/constants/map';
import { ScenarioInputSchema } from '@/lib/shared/schemas/scenario.schemas';

/** Cached list of all scenarios as flat summaries. */
export const listScenarios = createAction(null, async () => scenarioUseCases.list());

/** Cached full-scenario load. Returns null when the id is unknown. */
export const loadScenario = createAction(z.object({ id: z.string().min(1) }), async ({ data }) =>
  scenarioUseCases.findById(data),
);

/** Upsert a scenario. Generates a new id when `input.id` is omitted. */
export const saveScenario = createAction(ScenarioInputSchema, async ({ data, db }) => {
  const result = await scenarioUseCases.save(db, data);
  updateTag('pathfinder:scenarios');
  updateTag(`pathfinder:scenario:${result.id}`);
  revalidatePath('/');
  return result;
});

/**
 * Unwrapped redirect-issuing action. `redirect()` throws a framework signal
 * that `createAction`'s try/catch would convert into `{success: false}` —
 * the redirect must propagate to the runtime. Returns `Promise<never>`.
 *
 * The action calls `revalidatePath('/')` so the home page list sees the new
 * scenario on the next visit, but does NOT call `updateTag` — the redirect
 * lands on `/editor` whose data is loaded via `loadScenario`, which is not
 * a cached read for the brand-new id.
 */
export async function createBlankScenario(): Promise<never> {
  const db = (await import('@/lib/server/db/db')).default;
  const { scenarioId } = await scenarioUseCases.createBlank(db, DEFAULT_MAP_DIMS);
  revalidatePath('/');
  redirect(`/editor?id=${scenarioId}`);
}
