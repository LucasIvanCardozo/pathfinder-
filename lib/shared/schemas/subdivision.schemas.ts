import { z } from "zod";

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Subdivision configs are GLOBAL — every floor in
 * every scenario shares the same set. They are stored in the database and
 * can be managed at runtime via the admin UI.
 */
export const SubdivisionConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Nombre requerido").max(100),
  pieceIds: z.array(z.string().min(1)),
  cellSizeRatio: z.number().int().min(1).max(64),
  order: z.number().int().min(0).max(20),
});

/** Input shape for create/update — omits the persisted `id`. */
export const SubdivisionConfigInputSchema = SubdivisionConfigSchema.omit({ id: true });

/** Same as the input shape, named for the consumer (manager UI). */
export const SubdivisionConfigPieceIdsInputSchema = SubdivisionConfigInputSchema;