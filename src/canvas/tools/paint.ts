// Pure paint reducer. Given the current painted-cells array plus a stroke,
// returns a NEW array with the affected cells updated. Stateless: the
// reducer is safe to call inside `setPaintedCells((prev) => applyPaintStroke(...))`.

import { defaultEntityStateFor } from '@/canvas/traits';
import type { BrushCell, PaintStrokeInput, PaintedCell } from './types';

function cellKey(floorId: string, subdivisionId: string, gridX: number, gridY: number): string {
  return `${floorId}|${subdivisionId}|${gridX}|${gridY}`;
}

/**
 * Apply a paint stroke to the painted-cells array.
 *
 * Behaviour per affected cell:
 *   - no existing cell → insert a new cell with `pieceId` and the piece's
 *     default `entityState`.
 *   - existing cell with the SAME `pieceId` → preserve as-is. The cell id
 *     and `entityState` (e.g. door open/closed/locked) survive so the GM's
 *     right-click state edits aren't lost on every repaint.
 *   - existing cell with a DIFFERENT `pieceId` → replace; reset
 *     `entityState` to the new piece's defaults.
 *
 * Cells outside the stroke are returned untouched.
 */
export function applyPaintStroke(input: PaintStrokeInput): PaintedCell[] {
  const { stroke, pieceId, pieceById, paintedCells, generateId } = input;
  // Index existing cells by composite key for O(1) lookup. We rebuild the
  // array at the end so callers can rely on insertion-stable iteration.
  const byKey = new Map<string, BrushCell>();
  for (const cell of stroke.cells) {
    byKey.set(cellKey(stroke.floorId, stroke.subdivisionId, cell.gridX, cell.gridY), cell);
  }

  const piece = pieceById.get(pieceId);
  const defaultState = piece ? defaultEntityStateFor(piece) : undefined;

  const out: PaintedCell[] = [];
  for (const existing of paintedCells) {
    const key = cellKey(existing.floorId, existing.subdivisionId, existing.gridX, existing.gridY);
    const strokeCell = byKey.get(key);
    if (!strokeCell) {
      out.push(existing);
      continue;
    }
    // Mark the stroke cell as handled so we don't re-add it after the loop.
    byKey.delete(key);
    if (existing.pieceId === pieceId) {
      // Same piece → preserve cell id and entityState untouched.
      out.push(existing);
      continue;
    }
    // Different piece (or no piece) → replace with fresh id + new defaults.
    out.push({
      id: generateId(),
      floorId: stroke.floorId,
      subdivisionId: stroke.subdivisionId,
      gridX: strokeCell.gridX,
      gridY: strokeCell.gridY,
      pieceId,
      entityState: defaultState as Record<string, string | number | boolean> | undefined,
    });
  }

  // Any remaining stroke cells had no existing painted cell — append new ones.
  for (const cell of byKey.values()) {
    out.push({
      id: generateId(),
      floorId: stroke.floorId,
      subdivisionId: stroke.subdivisionId,
      gridX: cell.gridX,
      gridY: cell.gridY,
      pieceId,
      entityState: defaultState as Record<string, string | number | boolean> | undefined,
    });
  }

  return out;
}
