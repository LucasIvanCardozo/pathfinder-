// Pure erase reducer. Mirrors `paint.ts` but only removes cells. Stateless.

import type { EraseStrokeInput, PaintedCell } from './types';

function cellCoordKey(gridX: number, gridY: number): string {
  return `${gridX}|${gridY}`;
}

/**
 * Remove every painted cell whose (floorId, subdivisionId, gridX, gridY)
 * matches one of the stroke cells. Per spec, erase only touches the active
 * subdivision — cells on OTHER subdivisions survive even when they share
 * the same logical grid coordinates. The caller (FloorCanvas) is expected
 * to have already filtered the stroke to a single floor + subdivision; we
 * still double-check here so the reducer is safe to call from anywhere.
 */
export function applyEraseStroke(input: EraseStrokeInput): PaintedCell[] {
  const { stroke, paintedCells } = input;
  const target = new Set<string>();
  for (const cell of stroke.cells) {
    target.add(cellCoordKey(cell.gridX, cell.gridY));
  }
  if (target.size === 0) return paintedCells.slice();
  return paintedCells.filter((cell) => {
    if (cell.floorId !== stroke.floorId) return true;
    if (cell.subdivisionId !== stroke.subdivisionId) return true;
    return !target.has(cellCoordKey(cell.gridX, cell.gridY));
  });
}
