import { z } from 'zod';

/**
 * A single floor inside a scenario. Floors are vertical slices of the same
 * map — they do not carry their own dimensions; the parent `Scenario` does.
 * Use `scenario.baseCellSize/width/height` for grid math.
 */
export const FloorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
});
