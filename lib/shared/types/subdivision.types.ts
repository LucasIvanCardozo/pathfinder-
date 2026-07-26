import type { z } from "zod";
import type {
  SubdivisionConfigInputSchema,
  SubdivisionConfigSchema,
} from "@/lib/shared/schemas/subdivision.schemas";

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Pieces are global — any piece can be painted into
 * any subdivision cell. The `cellSizeRatio` controls how granular the layer
 * is (ratio 4 has 16x more cells per floor cell than ratio 1), and `order`
 * controls the Z-stack.
 */
export type SubdivisionConfig = z.infer<typeof SubdivisionConfigSchema>;

export type SubdivisionConfigInput = z.infer<typeof SubdivisionConfigInputSchema>;

/**
 * The default subdivision seed payload. Loaded by `prisma/seed.ts` and by
 * `subdivisionUseCases.seedDefaults(db)` (idempotent app-side repair).
 *
 * Pieces used to be scoped per-subdivision (the "Puertas" subdivision owned
 * the door piece, etc.); that coupling is gone. The door piece is now in the
 * global piece registry and the door trait (`door-states`) is what makes it
 * interactive when painted anywhere.
 */
export const DEFAULT_SUBDIVISIONS: SubdivisionConfigInput[] = [
  {
    name: "Suelo",
    cellSizeRatio: 1,
    order: 0,
  },
  {
    name: "Objetos",
    cellSizeRatio: 4,
    order: 1,
  },
  {
    name: "Paredes",
    cellSizeRatio: 8,
    order: 2,
  },
];