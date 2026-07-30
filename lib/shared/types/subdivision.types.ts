import type { z } from 'zod';
import type { SubdivisionConfigSchema } from '@/lib/shared/schemas/subdivision.schemas';

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Subdivisions are IMMUTABLE — there is no runtime
 * CRUD for them. The set below is the source of truth and is referenced by
 * id from `PaintedCell.subdivisionId`. Hardcoded ids survive `pnpm db:pr:reset`
 * and are the same on every deployment.
 *
 * Pieces are NOT scoped to a subdivision: any piece can be painted into any
 * subdivision cell. The `cellSizeRatio` controls how granular the layer is
 * (ratio 4 has 16x more cells per floor cell than ratio 1), and `order`
 * controls the Z-stack — `FloorCanvas` renders one Konva Layer per
 * subdivision in `order` ascending.
 */
export type SubdivisionConfig = z.infer<typeof SubdivisionConfigSchema>;

/**
 * The canonical subdivision set. Frozen so accidental mutation throws at
 * runtime instead of silently misaligning id-references across the app.
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
export const SUBDIVISIONS: readonly SubdivisionConfig[] = Object.freeze([
  { id: 'suelo', name: 'Suelo', cellSizeRatio: 1, order: 0 },
  { id: 'objetos-grandes', name: 'Objetos grandes', cellSizeRatio: 3, order: 1 },
  { id: 'objetos-pequenos', name: 'Objetos pequeños', cellSizeRatio: 6, order: 2 },
  { id: 'estructuras', name: 'Estructuras', cellSizeRatio: 1, order: 3 },
]);