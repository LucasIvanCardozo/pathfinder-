import type { z } from "zod";
import type {
  SubdivisionConfigPieceIdsInputSchema,
  SubdivisionConfigSchema,
} from "@/lib/shared/schemas/subdivision.schemas";

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Subdivision configs are GLOBAL — every floor in
 * every scenario shares the same set. They are stored in the database and
 * can be managed at runtime via the admin UI.
 */
export type SubdivisionConfig = z.infer<typeof SubdivisionConfigSchema>;

export type SubdivisionConfigInput = z.infer<typeof SubdivisionConfigPieceIdsInputSchema>;

/**
 * The default subdivision seed payload. Loaded by `prisma/seed.ts` and by
 * `subdivisionUseCases.seedDefaults(db)` (idempotent app-side repair).
 *
 * The door piece is in `Paredes` — it has the door-states trait and behaves
 * like a door when painted. door-closed / door-open / door-locked are
 * visualStates of that single Piece; the trait decides which state to
 * render.
 */
export const DEFAULT_SUBDIVISIONS: SubdivisionConfigInput[] = [
  {
    name: "Suelo",
    pieceIds: ["floor-stone", "floor-wood", "floor-sand", "water-plain", "lava-plain", "floor-pasto"],
    cellSizeRatio: 1,
    order: 0,
  },
  {
    name: "Objetos",
    pieceIds: ["decoration-marker"],
    cellSizeRatio: 4,
    order: 1,
  },
  {
    name: "Paredes",
    pieceIds: ["wall-stone", "door"],
    cellSizeRatio: 8,
    order: 2,
  },
];