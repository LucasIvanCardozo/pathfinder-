/**
 * Brush footprint bounds, in subdivision cells. The brush is always an odd
 * square so it has a unique centre cell; `MAX_BRUSH_SIZE = 9` caps the
 * footprint at 9×9 subdivision cells (81 cells per stroke).
 *
 * `BrushSize` is a branded numeric type defined in
 * `src/canvas/tools/types.ts`; the constants here are plain numbers so the
 * normaliser can use them directly.
 */
export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 7;

/**
 * The set of supported brush shapes. The constants here stay in lock-step
 * with the `BrushShape` union in `src/canvas/tools/types.ts` so a new shape
 * can only land by extending both (and the indexed `brushOffsets` cache, the
 * reducer call sites, and the PaintToolbar segmented control).
 *
 * - `circle` is the default and matches the historical behaviour (rounded
 *   disc via `dx² + dy² ≤ radius²`).
 * - `square` is the full odd-by-odd footprint with crisp edges; useful for
 *   fill work or when the user wants to align strokes to the grid without
 *   the rounded corners.
 */
export const BRUSH_SHAPES = ['circle', 'square'] as const;

/**
 * Default brush shape used by the editor on first load. Mirrored as
 * `DEFAULT_BRUSH_SHAPE` so callers don't have to know the array position.
 */
export const DEFAULT_BRUSH_SHAPE = 'circle';