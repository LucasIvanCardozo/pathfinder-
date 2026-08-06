'use client';

import { useMemo } from 'react';
import { DARKNESS_PIECE_ID } from '@/lib/shared/constants';
import type { PaintedCell, SubdivisionConfig } from '@/lib/shared/types';
import { PREVIEW_STYLE, type PreviewStyleKey } from '../components/floor-canvas/previewStyle';
import type { BrushCell, BrushShape, BrushSize, ToolKind } from '../tools';
import { brushCellsAt, clipFootprintByWalls } from '../tools';

export type BrushPreview = {
  /** Cells to render in the brush preview Layer. */
  cells: BrushCell[];
  /** Inline style tokens used by the Konva rect renderer. */
  style: { stroke: string; fill: string };
};

export type UseBrushPreviewArgs = {
  tool: ToolKind;
  darknessMode: 'apply' | 'erase';
  hoverCell: BrushCell | null;
  /** Resolved active subdivision, or `null` when the editor has none selected. */
  activeSubdivision: SubdivisionConfig | null | undefined;
  activeSubdivisionId: string;
  /** Painted cells for the current floor (pre-filtered by the parent). */
  cells: readonly PaintedCell[];
  brushSize: BrushSize;
  brushShape: BrushShape;
  /** Map dimensions. Used to derive the preview's per-cell size: for the
   *  darkness tool the preview renders in obscured-space cells (`baseCellSize`
   *  × `cellSizeRatio 1`); for paint/erase it renders in active-subdivision
   *  cells (`baseCellSize / activeSubdivision.cellSizeRatio`). Callers pick
   *  which `cellSize` to use via the `previewCellSize` returned here. */
  mapDims: { baseCellSize: number; width: number; height: number };
};

/**
 * Resolve which `PREVIEW_STYLE` key to use for the current `(tool, mode)`
 * pair. `darkness` + `erase` reads from the dedicated `darknessErase` slot;
 * every other (tool, mode) combination reads from `tool` directly.
 */
function styleKeyFor(tool: ToolKind, darknessMode: 'apply' | 'erase'): PreviewStyleKey {
  if (tool === 'darkness' && darknessMode === 'erase') return 'darknessErase';
  return tool;
}

/**
 * Compute the brush preview geometry for the active floor.
 *
 * Behaviour per (tool, darknessMode):
 *
 * - `paint` / `erase` (non-darkness): full brush footprint at `hoverCell`,
 *   wall-aware clipped (cells behind a structure wall are dropped). The wall
 *   filter applies uniformly, including when the active subdivision is
 *   `estructuras` itself: walls block other walls, and the algorithm's
 *   "centre is a wall -> only the centre is reachable" rule is the natural
 *   cost of hovering with a brush centred on an existing wall. Coordinates
 *   are in the active subdivision's grid space; the renderer multiplies by
 *   `activeSubdivision.cellSizeRatio`.
 *
 * - `darkness` + apply: full brush footprint, dark style. NOT wall-aware
 *   (the wall-aware-paint feature explicitly leaves darkness-apply out of
 *   scope so the dark "apply" behaviour stays predictable). Coordinates are
 *   in obscured-space (`cellSizeRatio 1`), independent of the active
 *   subdivision.
 *
 * - `darkness` + erase: intersection of the wall-aware footprint with the
 *   set of currently-dark cells on this floor, light style. The GM sees
 *   exactly which cells will lose their darkness on click — cells in the
 *   brush footprint that don't currently carry darkness are dropped, and
 *   cells behind a wall are dropped by the same wall-aware rule the
 *   darkness erase itself uses. Coordinates are in obscured-space.
 *
 * Returns `cells: []` (and the matching style key) when no hover cell or
 * no active subdivision — the renderer skips the Layer in that case.
 *
 * Pure React state hook: no Konva, no event handlers. Memoised so the
 * FloorCanvas memo comparator sees a stable reference between unrelated
 * renders.
 */
export function useBrushPreview(args: UseBrushPreviewArgs): BrushPreview {
  const {
    tool,
    darknessMode,
    hoverCell,
    activeSubdivision,
    cells,
    brushSize,
    brushShape,
    mapDims,
  } = args;

  // Wall predicate built from `cells`. Memoised on the cells reference so a
  // content-equal re-render (comparator passes) doesn't rebuild the Set.
  const isWall = useMemo(() => {
    const wallKeys = new Set<string>();
    for (const c of cells) {
      if (c.subdivisionId === 'estructuras') {
        wallKeys.add(`${c.gridX}|${c.gridY}`);
      }
    }
    return (x: number, y: number) => wallKeys.has(`${x}|${y}`);
  }, [cells]);

  // Set of currently-dark cells on this floor, keyed by `gridX|gridY`. Only
  // consulted by the darkness-erase preview path to clip the footprint to
  // cells that actually have darkness.
  const darkKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of cells) {
      if (c.pieceId === DARKNESS_PIECE_ID) {
        keys.add(`${c.gridX}|${c.gridY}`);
      }
    }
    return keys;
  }, [cells]);

  // Darkness always operates in obscured-space (cellSizeRatio 1) regardless
  // of the active subdivision. Without this, og/op would translate the click
  // to a different grid than the darkness cells live on and erase nothing.
  const darknessBounds = useMemo(
    () => ({ maxX: mapDims.width, maxY: mapDims.height }),
    [mapDims.width, mapDims.height],
  );

  return useMemo<BrushPreview>(() => {
    const styleKey = styleKeyFor(tool, darknessMode);
    const style = PREVIEW_STYLE[styleKey];

    if (!activeSubdivision || !hoverCell) {
      return { cells: [], style };
    }

    const useDarknessSpace = tool === 'darkness';
    const bounds = useDarknessSpace
      ? darknessBounds
      : {
          maxX: mapDims.width * activeSubdivision.cellSizeRatio,
          maxY: mapDims.height * activeSubdivision.cellSizeRatio,
        };
    const footprint = brushCellsAt(hoverCell, brushSize, bounds, brushShape);

    // Wall-aware preview applies to paint, erase, and darkness-erase,
    // uniformly across every active subdivision (including `estructuras`).
    const wallFilterEligible =
      tool === 'paint' || tool === 'erase' || (tool === 'darkness' && darknessMode === 'erase');
    const wallFiltered = wallFilterEligible
      ? clipFootprintByWalls(hoverCell, footprint, isWall)
      : footprint;

    // Darkness-erase: further filter to currently-dark cells (what the
    // click would actually remove). Cells in the footprint that don't
    // carry darkness are dropped.
    if (tool === 'darkness' && darknessMode === 'erase') {
      const intersection: BrushCell[] = [];
      for (const c of wallFiltered) {
        if (darkKeys.has(`${c.gridX}|${c.gridY}`)) intersection.push(c);
      }
      return { cells: intersection, style };
    }

    return { cells: wallFiltered, style };
  }, [
    activeSubdivision,
    hoverCell,
    mapDims.width,
    mapDims.height,
    brushSize,
    brushShape,
    tool,
    darknessMode,
    isWall,
    darkKeys,
    darknessBounds,
  ]);
}
