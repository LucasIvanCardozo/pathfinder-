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