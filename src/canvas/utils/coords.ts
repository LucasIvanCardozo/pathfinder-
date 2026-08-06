// Coordinate-space conversions for the canvas tool layer. Server-safe
// (no React/Konva) so the helpers can be reused from usePaintStroke,
// useBrushPreview, useCanvasEventHandlers, and the spell preview.

import type { BrushCell } from '../tools';

/**
 * Convert a cell from active-subdivision space to obscured-space
 * (cellSizeRatio 1). For ratio 1 (`suelo` / `estructuras` / `obscured`)
 * the transform is the identity. For `objetos-grandes` (ratio 2) and
 * `objetos-pequenos` (ratio 4) we rescale by dividing the active-space
 * coord by the ratio.
 *
 * The conversion is the inverse of `pointerToCell` projected onto the
 * cell grid: `obscuredX = activeX / cellSizeRatio`. Floor-dividing keeps
 * the cell anchored at the top-left of its world-pixel footprint, which
 * matches the way `pointerToCell` rounds the world pointer to a cell.
 *
 * Used by every code path that bridges between the active subdivision's
 * grid and the obscured grid: brush preview for the darkness tool, spell
 * preview, spell placement, and the per-cell render of placed spells.
 */
export function toObscuredSpace(cell: BrushCell, cellSizeRatio: number): BrushCell {
  if (cellSizeRatio <= 1) return cell;
  return {
    gridX: Math.floor(cell.gridX / cellSizeRatio),
    gridY: Math.floor(cell.gridY / cellSizeRatio),
  };
}
