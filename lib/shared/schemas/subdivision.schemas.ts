import { z } from "zod";

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Subdivision configs are GLOBAL — every floor in
 * every scenario shares the same set. They are stored in the database and
 * can be managed at runtime via the admin UI.
 *
 * Pieces are NOT scoped to a subdivision: any piece can be painted into any
 * subdivision cell. The `cellSizeRatio` controls how granular the layer's
 * grid is (a subdivision with ratio 4 has 16x more cells per floor cell
 * than one with ratio 1), and `order` controls the Z-stack.
 */
export const SubdivisionConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Nombre requerido").max(100),
  cellSizeRatio: z.number().int().min(1).max(64),
  order: z.number().int().min(0).max(20),
});

/** Input shape for create/update — omits the persisted `id`. */
export const SubdivisionConfigInputSchema = SubdivisionConfigSchema.omit({ id: true });