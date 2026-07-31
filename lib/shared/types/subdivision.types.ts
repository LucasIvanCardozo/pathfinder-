import type { z } from 'zod';
import type { SubdivisionConfigSchema } from '@/lib/shared/schemas/subdivision.schemas';

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Subdivisions are IMMUTABLE — there is no runtime
 * CRUD for them. The canonical set lives in
 * `lib/shared/constants/subdivisions.ts` (`SUBDIVISIONS`).
 *
 * Pieces are NOT scoped to a subdivision: any piece can be painted into any
 * subdivision cell. The `cellSizeRatio` controls how granular the layer is
 * (ratio 4 has 16x more cells per floor cell than ratio 1), and `order`
 * controls the Z-stack — `FloorCanvas` renders one Konva Layer per
 * subdivision in `order` ascending.
 */
export type SubdivisionConfig = z.infer<typeof SubdivisionConfigSchema>;