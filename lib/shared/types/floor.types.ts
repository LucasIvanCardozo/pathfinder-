import type { z } from 'zod';
import { DEFAULT_FLOOR_NAMES } from '@/lib/shared/floors/naming';
import type { FloorSchema } from '@/lib/shared/schemas/floor.schemas';

/**
 * A single floor inside a scenario. Carries only its identity and display
 * name; map dimensions (`baseCellSize`, `width`, `height`) belong to the
 * parent `Scenario` so all floors in a scenario always share them.
 */
export type Floor = z.infer<typeof FloorSchema>;

/**
 * Default floor list for brand-new scenarios. The display names come from
 * `lib/shared/floors/naming.ts` so the editor, the seed payload, and the
 * default-scenario creation use case stay in lock-step.
 *
 * The map dimensions come from the scenario-level constants in
 * `lib/shared/constants/map.ts`; floors inherit them automatically.
 *
 * `id` is an empty placeholder; the repository assigns real ids via
 * `generateId("floor")` at insert time.
 */
export const DEFAULT_FLOORS: Floor[] = DEFAULT_FLOOR_NAMES.map((name) => ({
  id: '',
  name,
}));
