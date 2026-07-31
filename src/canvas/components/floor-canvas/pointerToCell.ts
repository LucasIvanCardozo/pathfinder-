import type { BrushCell } from '../../tools';

/**
 * Convert a world-space pointer to a subdivision grid cell, or `null` when the
 * pointer is outside the active subdivision's bounds. Pure function so it can
 * be shared between mousedown/mousemove/mouseleave handlers without the
 * `useCallback` indirection.
 */
export function pointerToCell(
  pointer: { x: number; y: number },
  viewport: { activeCellSize: number; activeMaxX: number; activeMaxY: number },
): BrushCell | null {
  const { activeCellSize, activeMaxX, activeMaxY } = viewport;
  if (activeCellSize <= 0) return null;
  const gx = Math.floor(pointer.x / activeCellSize);
  const gy = Math.floor(pointer.y / activeCellSize);
  if (gx < 0 || gy < 0 || gx >= activeMaxX || gy >= activeMaxY) return null;
  return { gridX: gx, gridY: gy };
}
