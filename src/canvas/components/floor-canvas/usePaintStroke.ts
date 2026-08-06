'use client';

import { useCallback, useRef } from 'react';
import { DARKNESS_PIECE_ID } from '@/lib/shared/constants';
import type { BrushCell, BrushShape, BrushSize, StrokeFootprint, ToolKind } from '../../tools';
import { clipFootprintByWalls, computeStrokeCells, computeStrokeFootprints } from '../../tools';

type ApplyArgs = {
  pointer: { x: number; y: number };
  isDragging: boolean;
  floorId: string;
  activeSubdivisionId: string;
  activePieceId: string | null;
  brushSize: BrushSize;
  brushShape: BrushShape;
  /** Bounds for paint/erase in active-subdivision cell units. Ignored for
   *  the darkness tool — that path uses obscured bounds (`mapDims.width`,
   *  `mapDims.height`). */
  bounds: { maxX: number; maxY: number };
  /** Map dimensions in `cellSizeRatio 1` cells. The darkness path uses
   *  `width` × `height` as its bounds so it operates in obscured-space,
   *  independent of the active subdivision (og/op have ratio > 1, which
   *  would translate the click to a different grid than the darkness
   *  cells live on). */
  mapDims: { baseCellSize: number; width: number; height: number };
  onPaint: (
    floorId: string,
    subdivisionId: string,
    cells: BrushCell[],
    pieceId: string | null,
  ) => void;
  /**
   * Called when the darkness tool is in erase mode. Receives one stamp per
   * Bresenham step so the owner can apply wall-aware BFS per `centre` with
   * structure cells as propagation walls. Coordinates only — the owner
   * looks up matching ids.
   */
  onDarknessErase: (floorId: string, footprints: StrokeFootprint[]) => void;
  pointerToCell: (pointer: { x: number; y: number }) => BrushCell | null;
  tool: ToolKind;
  darknessMode: 'apply' | 'erase';
  /**
   * Optional wall predicate (cell -> true if painted as `estructuras`). When
   * provided, paint and erase strokes are filtered through `clipFootprintByWalls`
   * per stamp so the brush cannot paint or erase across a structure wall —
   * same invariant the darkness erase and spell markers already use.
   *
   * Applied uniformly regardless of the active subdivision, including when
   * painting on `estructuras` itself: walls block other walls exactly like
   * they block paint on any other subdivision. The algorithm's "centre is a
   * wall -> only the centre is reachable" rule is the natural cost of
   * painting with a brush centred on an existing wall.
   */
  isWall?: (x: number, y: number) => boolean;
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
 *
 * Wall-aware behaviour: paint and erase (non-darkness) apply
 * `clipFootprintByWalls` per Bresenham stamp when `isWall` is provided. This
 * reuses the same primitive that drives darkness erase and spell markers —
 * walls are opaque in every direction, light does not bend around them.
 *
 * Darkness space: the darkness tool always operates in obscured-space
 * (`cellSizeRatio 1`) regardless of the active subdivision. The Bresenham
 * interpolation needs an anchor in the same space, so the hook keeps a
 * dedicated `lastDarknessStrokeCellRef` instead of reusing
 * `lastStrokeCellRef` (which lives in active-subdivision space).
 */
export function usePaintStroke(): UsePaintStrokeResult {
  const lastStrokeCellRef = useRef<BrushCell | null>(null);
  // Darkness-only anchor. Lives in obscured-space so the Bresenham stays in
  // one coordinate system across a drag even when the active subdivision has
  // cellSizeRatio > 1.
  const lastDarknessStrokeCellRef = useRef<BrushCell | null>(null);

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
      mapDims,
      onPaint,
      onDarknessErase,
      pointerToCell,
      tool,
      darknessMode,
      isWall,
    } = args;

    const target = pointerToCell(pointer);
    if (!target) {
      // Out of bounds: clear both anchors and bail. The user picks up where
      // they re-enter the canvas.
      lastStrokeCellRef.current = null;
      lastDarknessStrokeCellRef.current = null;
      return;
    }
    const start = isDragging ? lastStrokeCellRef.current : null;
    lastStrokeCellRef.current = target;

    if (tool === 'darkness') {
      // Convert the active-subdivision cell into obscured-space (cellSizeRatio
      // 1) so the brush lines up with the cells painted on `obscured`. For
      // ratio 1 (suelo / estructuras / obscured) the conversion is the
      // identity and the result is exact.
      const ratioX = bounds.maxX / mapDims.width;
      const ratioY = bounds.maxY / mapDims.height;
      const obscuredTarget: BrushCell = {
        gridX: Math.floor(target.gridX / ratioX),
        gridY: Math.floor(target.gridY / ratioY),
      };
      const obscuredStart =
        isDragging && lastDarknessStrokeCellRef.current ? lastDarknessStrokeCellRef.current : null;
      lastDarknessStrokeCellRef.current = obscuredTarget;

      const darknessBounds = { maxX: mapDims.width, maxY: mapDims.height };
      if (darknessMode === 'erase') {
        // Per-centre footprints so the owner can apply wall-aware BFS per
        // stamp; the union is reconstructed downstream if needed.
        const footprints = computeStrokeFootprints(
          obscuredStart,
          obscuredTarget,
          brushSize,
          darknessBounds,
          brushShape,
        );
        onDarknessErase(floorId, footprints);
      } else {
        // Apply mode uses the fixed subdivision and sentinel pieceId.
        const cells = computeStrokeCells(
          obscuredStart,
          obscuredTarget,
          brushSize,
          darknessBounds,
          brushShape,
        );
        onPaint(floorId, 'obscured', cells, DARKNESS_PIECE_ID);
      }
      return;
    }

    // Any non-darkness tool cancels the darkness drag anchor. Without this,
    // a single touch-and-release across two different tools would still hold
    // an obscured-space cell as the darkness anchor on the next tick.
    lastDarknessStrokeCellRef.current = null;

    // Paint or erase (non-darkness). When a wall predicate is provided, clip
    // each Bresenham stamp against walls so the brush cannot tunnel through
    // a structure. The stamp-by-stamp loop matches `handleDarknessErase` so
    // a wall sitting between two consecutive stamps is respected on the next
    // one. The wall filter applies uniformly regardless of the active
    // subdivision — including `estructuras` itself, where walls block other
    // walls.
    const wallFilter = isWall ?? null;
    let cells: BrushCell[];
    if (wallFilter) {
      const footprints = computeStrokeFootprints(start, target, brushSize, bounds, brushShape);
      const seen = new Set<string>();
      const out: BrushCell[] = [];
      for (const { centre, cells: stamp } of footprints) {
        for (const c of clipFootprintByWalls(centre, stamp, wallFilter)) {
          const key = `${c.gridX}|${c.gridY}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(c);
        }
      }
      cells = out;
    } else {
      cells = computeStrokeCells(start, target, brushSize, bounds, brushShape);
    }

    if (tool === 'paint') {
      if (!activePieceId) return;
      onPaint(floorId, activeSubdivisionId, cells, activePieceId);
    } else {
      // tool === 'erase'
      onPaint(floorId, activeSubdivisionId, cells, null);
    }
  }, []);

  return { apply, lastStrokeCellRef };
}
