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
 * The four defaults each serve a distinct role in the layering:
 *
 *   - "Suelo" (ratio 1, z 0): the base floor texture. Same granularity as
 *     the floor's own grid (one subdivision cell = one floor cell).
 *   - "Objetos grandes" (ratio 3, z 1): large objects that occupy several
 *     floor cells each. 3x finer grid than the floor (9x more cells).
 *   - "Objetos pequeños" (ratio 6, z 2): small decorations. 6x finer grid
 *     than the floor (36x more cells).
 *   - "Estructuras" (ratio 1, z 3): floor-sized structures such as walls
 *     and doors that always align to the floor's own cell grid.
 */
export const DEFAULT_SUBDIVISIONS: SubdivisionConfigInput[] = [
  {
    name: "Suelo",
    cellSizeRatio: 1,
    order: 0,
  },
  {
    name: "Objetos grandes",
    cellSizeRatio: 3,
    order: 1,
  },
  {
    name: "Objetos pequeños",
    cellSizeRatio: 6,
    order: 2,
  },
  {
    name: "Estructuras",
    cellSizeRatio: 1,
    order: 3,
  },
];