import { z } from 'zod';
import { SCENARIO_LIMITS } from '@/lib/shared/constants';
import { FloorSchema } from '@/lib/shared/schemas/floor.schemas';
import { PaintedCellSchema } from '@/lib/shared/schemas/paintedCell.schemas';

/**
 * Full scenario as the editor sees it: persisted `id`, name, the map
 * dimensions (`baseCellSize`, `width`, `height`) that all floors share,
 * the floor set, the currently active floor id, and the painted-cell set.
 * Read-only shape used by `loadScenario` and editor props.
 */
export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(SCENARIO_LIMITS.NAME_MAX),
  baseCellSize: z
    .number()
    .int()
    .min(SCENARIO_LIMITS.BASE_CELL_SIZE.MIN)
    .max(SCENARIO_LIMITS.BASE_CELL_SIZE.MAX),
  width: z.number().int().min(SCENARIO_LIMITS.DIMENSION.MIN).max(SCENARIO_LIMITS.DIMENSION.MAX),
  height: z.number().int().min(SCENARIO_LIMITS.DIMENSION.MIN).max(SCENARIO_LIMITS.DIMENSION.MAX),
  floors: z.array(FloorSchema).min(1, 'Al menos un piso requerido'),
  activeFloorId: z.string().min(1),
  paintedCells: z.array(PaintedCellSchema),
});

/**
 * Input payload for saveScenario. Omits `activeFloorId` (the server resolves
 * the active floor on read). Includes an optional `id` so the action can
 * branch between create-new and update-existing without a second call. When
 * `id` is undefined, the server generates one and returns it.
 *
 * Map dimensions live on the scenario so all floors automatically share
 * them. No per-floor refinement is needed.
 */
export const ScenarioInputSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(SCENARIO_LIMITS.NAME_MAX),
  baseCellSize: z
    .number()
    .int()
    .min(SCENARIO_LIMITS.BASE_CELL_SIZE.MIN)
    .max(SCENARIO_LIMITS.BASE_CELL_SIZE.MAX),
  width: z.number().int().min(SCENARIO_LIMITS.DIMENSION.MIN).max(SCENARIO_LIMITS.DIMENSION.MAX),
  height: z.number().int().min(SCENARIO_LIMITS.DIMENSION.MIN).max(SCENARIO_LIMITS.DIMENSION.MAX),
  floors: z.array(FloorSchema).min(1),
  paintedCells: z.array(PaintedCellSchema),
});
