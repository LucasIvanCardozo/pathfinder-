'use client';

import { useCallback } from 'react';
import type { PaintedCell, Piece } from '@/lib/shared/types';

export type StrokeDiffResult = {
  /** Cell ids the server must delete (replaced or shadowed). */
  eraseIds: string[];
  /** New/replaced cells the server must insert. */
  paintCells: Array<{
    id: string;
    gridX: number;
    gridY: number;
    pieceId: string;
    entityState?: Record<string, string | number | boolean>;
  }>;
};

/**
 * Computes the bit of a paint stroke that the server needs to know about, by
 * diffing the prev/next painted-cells arrays. The two maps that drive the
 * lookup are produced with TWO distinct keys on purpose:
 *
 *   - `existingKey(c)` uses the floor/subdivision from the cell itself. This
 *     is how we index the lookup maps so cells from different floors sharing
 *     the same (gridX, gridY) don't collide. The previous version used a
 *     single closure-supplied (floor, subdivision) for both, which caused
 *     cells from other floors to be overwritten by the last cell to land on
 *     matching logical coordinates.
 *   - `strokeKey(gx, gy)` uses the stroke's floor/subdivision. The stroke
 *     is always one specific (floor, subdivision), so the lookup matches.
 */
export function usePaintStrokeDiff() {
  const computeStrokeDiff = useCallback(
    (
      currentPaintedCells: PaintedCell[],
      next: PaintedCell[],
      stroke: { floorId: string; subdivisionId: string; cells: { gridX: number; gridY: number }[] },
    ): StrokeDiffResult => {
      const existingKey = (c: {
        floorId: string;
        subdivisionId: string;
        gridX: number;
        gridY: number;
      }) => `${c.floorId}|${c.subdivisionId}|${c.gridX}|${c.gridY}`;
      const strokeKey = (gx: number, gy: number) =>
        `${stroke.floorId}|${stroke.subdivisionId}|${gx}|${gy}`;

      const prevByKey = new Map(currentPaintedCells.map((c) => [existingKey(c), c]));
      const nextByKey = new Map(next.map((c) => [existingKey(c), c]));

      const eraseIds: string[] = [];
      const paintCells: StrokeDiffResult['paintCells'] = [];

      for (const strokeCell of stroke.cells) {
        const key = strokeKey(strokeCell.gridX, strokeCell.gridY);
        const resulting = nextByKey.get(key);
        if (!resulting) continue;
        const prevCell = prevByKey.get(key);
        if (prevCell?.pieceId === resulting.pieceId) continue; // no-op
        if (prevCell) eraseIds.push(prevCell.id);
        paintCells.push({
          id: resulting.id,
          gridX: resulting.gridX,
          gridY: resulting.gridY,
          pieceId: resulting.pieceId,
          entityState: resulting.entityState,
        });
      }
      return { eraseIds, paintCells };
    },
    [],
  );

  /**
   * Returns the ids of cells that exist in `currentPaintedCells` at the same
   * (floor, subdivision, gridX, gridY) as any cell in the stroke. Used by the
   * erase path to compute the server's `eraseCells` op without rebuilding the
   * same composite-key map inline.
   */
  const computeRemovedIds = useCallback(
    (
      currentPaintedCells: PaintedCell[],
      stroke: { floorId: string; subdivisionId: string; cells: { gridX: number; gridY: number }[] },
    ): string[] => {
      const existingKey = (c: {
        floorId: string;
        subdivisionId: string;
        gridX: number;
        gridY: number;
      }) => `${c.floorId}|${c.subdivisionId}|${c.gridX}|${c.gridY}`;
      const strokeKey = (gx: number, gy: number) =>
        `${stroke.floorId}|${stroke.subdivisionId}|${gx}|${gy}`;
      const prevByKey = new Map(
        currentPaintedCells.map((c) => [existingKey(c), c]),
      );
      const removedIds: string[] = [];
      for (const cell of stroke.cells) {
        const existing = prevByKey.get(strokeKey(cell.gridX, cell.gridY));
        if (existing) removedIds.push(existing.id);
      }
      return removedIds;
    },
    [],
  );

  return { computeStrokeDiff, computeRemovedIds };
}

// Reference Piece to silence the unused-import linter when consumers add
// new params to the signature. (Kept to make the module a self-contained
// unit ready for future shape changes.)
type _PieceRef = Piece;
