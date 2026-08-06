'use client';

import { useCallback, useRef } from 'react';
import { DARKNESS_PIECE_ID } from '@/lib/shared/constants';
import type { BrushCell, BrushShape, BrushSize, StrokeFootprint, ToolKind } from '../../tools';
import { computeStrokeCells, computeStrokeFootprints } from '../../tools';

type ApplyArgs = {
  pointer: { x: number; y: number };
  isDragging: boolean;
  floorId: string;
  activeSubdivisionId: string;
  activePieceId: string | null;
  brushSize: BrushSize;
  brushShape: BrushShape;
  bounds: { maxX: number; maxY: number };
  onPaint: (
    floorId: string,
    subdivisionId: string,
    cells: BrushCell[],
    pieceId: string | null,
  ) => void;
  /**
   * Called when the darkness tool is in erase mode. Receives one stamp per
   * Bresenham step so the owner can BFS from each `centre` with structure
   * cells as propagation walls. Coordinates only — the owner looks up
   * matching ids.
   */
  onDarknessErase: (floorId: string, footprints: StrokeFootprint[]) => void;
  pointerToCell: (pointer: { x: number; y: number }) => BrushCell | null;
  tool: ToolKind;
  darknessMode: 'apply' | 'erase';
};

export type UsePaintStrokeResult = {
  apply: (args: ApplyArgs) => void;
  lastStrokeCellRef: React.MutableRefObject<BrushCell | null>;
};

/**
 * Owns the paint stroke pipeline: pointer → cell → brush footprint →
 * interpolated stroke → `onPaint`. The `lastStrokeCellRef` is the anchor the
 * next sample interpolates from; clearing it (on stroke end / out-of-bounds)
 * starts a fresh stamp on the next pointer move.
 *
 * The `apply` callback is `useCallback([])`-stable because every input it
 * needs is passed in by the caller (FloorCanvas). That keeps FloorCanvas's
 * memo working.
 */
export function usePaintStroke(): UsePaintStrokeResult {
  const lastStrokeCellRef = useRef<BrushCell | null>(null);

  const apply = useCallback((args: ApplyArgs) => {
    const {
      pointer,
      isDragging,
      floorId,
      activeSubdivisionId,
      activePieceId,
      brushSize,
      brushShape,
      bounds,
      onPaint,
      onDarknessErase,
      pointerToCell,
      tool,
      darknessMode,
    } = args;

    const target = pointerToCell(pointer);
    if (!target) {
      // Out of bounds: clear the interpolation anchor but do not emit a
      // stroke. The user will pick up where they re-enter the canvas.
      lastStrokeCellRef.current = null;
      return;
    }
    const start = isDragging ? lastStrokeCellRef.current : null;
    lastStrokeCellRef.current = target;

    if (tool === 'darkness') {
      if (darknessMode === 'erase') {
        // Per-centre footprints so the owner can apply wall-aware BFS per
        // stamp; the union is reconstructed downstream if needed.
        const footprints = computeStrokeFootprints(start, target, brushSize, bounds, brushShape);
        onDarknessErase(floorId, footprints);
      } else {
        // Apply mode uses the fixed subdivision and sentinel pieceId.
        const cells = computeStrokeCells(start, target, brushSize, bounds, brushShape);
        onPaint(floorId, 'obscured', cells, DARKNESS_PIECE_ID);
      }
    } else {
      const cells = computeStrokeCells(start, target, brushSize, bounds, brushShape);
      if (tool === 'paint') {
        if (!activePieceId) return;
        onPaint(floorId, activeSubdivisionId, cells, activePieceId);
      } else {
        onPaint(floorId, activeSubdivisionId, cells, null);
      }
    }
  }, []);

  return { apply, lastStrokeCellRef };
}
