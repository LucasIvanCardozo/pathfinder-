import { z } from "zod";
import { FloorSchema } from "@/lib/shared/schemas/floor.schemas";
import { PaintedCellSchema } from "@/lib/shared/schemas/paintedCell.schemas";

/**
 * Full scenario as the editor sees it: persisted `id`, name, the map
 * dimensions (`baseCellSize`, `width`, `height`) that all floors share,
 * the floor set, the currently active floor id, and the painted-cell set.
 * Read-only shape used by `loadScenario` and editor props.
 */
export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  baseCellSize: z.number().int().min(10).max(200),
  width: z.number().int().min(1).max(500),
  height: z.number().int().min(1).max(500),
  floors: z.array(FloorSchema).min(1, "Al menos un piso requerido"),
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
  name: z.string().min(1).max(200),
  baseCellSize: z.number().int().min(10).max(200),
  width: z.number().int().min(1).max(500),
  height: z.number().int().min(1).max(500),
  floors: z.array(FloorSchema).min(1),
  paintedCells: z.array(PaintedCellSchema),
});