'use client';

import type Konva from 'konva';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';
import { usePieceMap, useSubdivisionMap } from '@/hooks';
import { telemetry } from '@/dev/perf/telemetry';
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from '@/lib/shared/types';
import type { BrushCell, BrushShape, BrushSize, ToolKind } from '../tools';
import { brushCellsAt } from '../tools';
import { useCanvasEventHandlers } from './floor-canvas/useCanvasEventHandlers';
import { floorCanvasPropsAreEqual } from './floor-canvas/comparators';
import { depthToTier } from './floor-canvas/depthToTier';
import { pointerToCell } from './floor-canvas/pointerToCell';
import { PREVIEW_STYLE } from './floor-canvas/previewStyle';
import { resolveRenderImagePath } from './floor-canvas/resolveRenderImagePath';
import { usePaintStroke } from './floor-canvas/usePaintStroke';
import styles from './floor-canvas.module.css';

type MapDims = { baseCellSize: number; width: number; height: number };

export type Props = {
  floor: Floor;
  /** Painted cells for this floor only. The parent (FloorStack) pre-filters. */
  cells: PaintedCell[];
  /** 0 = active floor, 1 = one floor below, etc. Drives the CSS depth
   *  filter (blur + opacity) applied to the floor container. */
  depthFromActive: number;
  /** Only the active floor attaches event handlers and Stage `listening`. */
  isActive: boolean;
  mapDims: MapDims;
  subdivisions: readonly SubdivisionConfig[];
  pieces: Piece[];
  activeSubdivisionId: string;
  activePieceId: string | null;
  tool: ToolKind;
  /** Brush footprint in active-subdivision cells. Always odd; size 1 = single cell. */
  brushSize: BrushSize;
  /** Geometric shape of the brush footprint (circle vs. square). Propagated
   *  through `computeStrokeCells` so the painter and the hover preview
   *  agree on the same footprint. */
  brushShape: BrushShape;
  /** Loaded texture images keyed by `imagePath`. One HTMLImageElement per path
   *  — depth blur is now done in CSS. */
  textureImages: Map<string, HTMLImageElement>;
  viewportSize: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
  /** Begin a pan drag (from the viewport hook). */
  beginPan: (clientX: number, clientY: number) => void;
  isSpaceDown: boolean;
  isPanning: boolean;
  /**
   * Fired when the user clicks or drags across the active floor with the paint
   * or erase tool. The `cells` array is the full interpolated stroke (every
   * cell touched by the brush footprint between consecutive pointer samples),
   * already clipped to the active subdivision's bounds. `pieceId` is `null`
   * for the erase tool.
   */
  onPaint?: (
    floorId: string,
    subdivisionId: string,
    cells: BrushCell[],
    pieceId: string | null,
  ) => void;
  /** ONLY attached when `isActive`. Opens an interactive trait menu (e.g.
   *  door-states right-click). */
  onOpenTraitMenu?: (
    cellId: string,
    traitKind: string,
    screenPos: { x: number; y: number },
  ) => void;
};

function FloorCanvasImpl({
  floor,
  cells,
  depthFromActive,
  isActive,
  mapDims,
  subdivisions,
  pieces,
  activeSubdivisionId,
  activePieceId,
  tool,
  brushSize,
  brushShape,
  textureImages,
  viewportSize,
  pan,
  zoom,
  beginPan,
  isSpaceDown,
  isPanning,
  onPaint,
  onOpenTraitMenu,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const isDrawingRef = useRef(false);
  const { apply, lastStrokeCellRef } = usePaintStroke();
  // Throttle hover state updates to once per cell change so the preview
  // doesn't re-render the whole tree on every mouse-move tick.
  const [hoverCell, setHoverCell] = useState<BrushCell | null>(null);

  // Clear the brush preview when this floor stops being the active one
  // (e.g. user pressed Shift+ArrowUp with the cursor inside the canvas).
  useEffect(() => {
    if (!isActive) setHoverCell(null);
  }, [isActive]);

  // Render counter. Lives inside FloorCanvas so React.memo gates it: when
  // the comparator returns true the useLayoutEffect never runs and
  // `recordRender` is never called. `useLayoutEffect` fires pre-paint so
  // the measured duration is closer to actual render cost. Strict Mode
  // (dev only) runs the effect twice → +2 per logical mount; production
  // has Strict Mode off and the count is exact.
  const renderStartRef = useRef(0);
  renderStartRef.current = performance.now();
  useLayoutEffect(() => {
    telemetry.recordRender(floor.id, performance.now() - renderStartRef.current);
  });

  const subById = useSubdivisionMap(subdivisions);
  const pieceById = usePieceMap(pieces);

  // Bucket cells by subdivision (defensive against stale ids by dropping
  // misses), then sort by `subdivision.order`. Konva draws in DOM order,
  // so Layer order mirrors the z-stack (Suelo=0 ... Estructuras=3) and
  // each layer paints over the previous one.
  const cellsBySub = useMemo(() => {
    const buckets = new Map<string, PaintedCell[]>();
    for (const c of cells) {
      const arr = buckets.get(c.subdivisionId);
      if (arr) {
        arr.push(c);
      } else {
        buckets.set(c.subdivisionId, [c]);
      }
    }
    const out: Array<{ sub: SubdivisionConfig; cells: PaintedCell[] }> = [];
    for (const [subId, subCells] of buckets) {
      const sub = subById.get(subId);
      if (!sub) continue;
      out.push({ sub, cells: subCells });
    }
    out.sort((a, b) => a.sub.order - b.sub.order);
    return out;
  }, [cells, subById]);

  // Render-time cellSize helper (world coords; the Stage scales on output).
  const cellSizeFor = (sub: SubdivisionConfig): number => mapDims.baseCellSize / sub.cellSizeRatio;

  // Compute the active subdivision's cellSize and bounds, or `null` if the
  // active subdivision isn't loaded. Inlined in `apply` and reused by the
  // hover preview to keep both paths in sync.
  const activeSubdivision = subById.get(activeSubdivisionId);
  const activeCellSize = activeSubdivision
    ? mapDims.baseCellSize / activeSubdivision.cellSizeRatio
    : 0;
  const activeMaxX = activeSubdivision ? mapDims.width * activeSubdivision.cellSizeRatio : 0;
  const activeMaxY = activeSubdivision ? mapDims.height * activeSubdivision.cellSizeRatio : 0;

  // Convert a world-space pointer to a subdivision grid cell, or null when
  // the pointer is outside the active subdivision's bounds. Centralised so
  // mousedown/mousemove/mouseleave stay in sync.
  const pointerToCellLocal = useCallback(
    (pointer: { x: number; y: number }): BrushCell | null =>
      pointerToCell(pointer, { activeCellSize, activeMaxX, activeMaxY }),
    [activeCellSize, activeMaxX, activeMaxY],
  );

  const applyLocal = useCallback(
    (pointer: { x: number; y: number }, isDragging: boolean) => {
      apply({
        pointer,
        isDragging,
        floorId: floor.id,
        activeSubdivisionId,
        activePieceId,
        brushSize,
        brushShape,
        bounds: { maxX: activeMaxX, maxY: activeMaxY },
        onPaint: onPaint ?? (() => {}),
        pointerToCell: pointerToCellLocal,
        tool,
      });
    },
    [
      apply,
      floor.id,
      activeSubdivisionId,
      activePieceId,
      brushSize,
      brushShape,
      activeMaxX,
      activeMaxY,
      onPaint,
      pointerToCellLocal,
      tool,
    ],
  );

  // Update the preview hover cell. Only fires a state update when the cell
  // actually changes — moving the cursor inside the same cell is a no-op,
  // which keeps the Konva tree from re-rendering on every pointer tick.
  const updateHoverCell = useCallback((cell: BrushCell | null) => {
    setHoverCell((prev) => {
      if (!prev && !cell) return prev;
      if (prev && cell && prev.gridX === cell.gridX && prev.gridY === cell.gridY) return prev;
      return cell;
    });
  }, []);

  const events = useCanvasEventHandlers({
    stageRef,
    isActive,
    isSpaceDown,
    isPanning,
    isDrawingRef,
    lastStrokeCellRef,
    apply: applyLocal,
    updateHoverCell,
    beginPan,
    pointerToCell: pointerToCellLocal,
    floorId: floor.id,
    cells,
    mapDims,
    subById,
    pieceById,
    onOpenTraitMenu,
  });

  // Cursor reflects the current interaction: default crosshair (paint),
  // grab when space is held, grabbing while a pan drag is in progress.
  const baseCursor = tool === 'erase' ? 'cell' : 'crosshair';
  const cursor = isSpaceDown ? (isPanning ? 'grabbing' : 'grab') : baseCursor;

  // Pick the CSS tier class for this floor. tier0 is the active floor
  // (sharp + fully opaque); tier1..tier3 are progressively blurred + dimmed.
  const tier = depthToTier(depthFromActive);
  const tierClass =
    tier === 0
      ? styles.tier0
      : tier === 1
        ? styles.tier1
        : tier === 2
          ? styles.tier2
          : styles.tier3;
  const className = `${styles.floor} ${tierClass}${isActive ? ` ${styles.interactive}` : ''}`;

  // Always-visible, non-interactive brush preview. Renders one outlined
  // rect per cell in the brush footprint at the current hover position.
  // Empty when the cursor is outside the canvas or no subdivision is
  // active. The `Layer` is `listening={false}` so it never intercepts
  // pointer events — paint strokes still flow through to the active
  // floor's hit testing.
  const previewCells = useMemo(() => {
    if (!activeSubdivision || !hoverCell) return [];
    const bounds = {
      maxX: mapDims.width * activeSubdivision.cellSizeRatio,
      maxY: mapDims.height * activeSubdivision.cellSizeRatio,
    };
    return brushCellsAt(hoverCell, brushSize, bounds, brushShape);
  }, [activeSubdivision, hoverCell, brushSize, brushShape, mapDims.width, mapDims.height]);
  const previewCellSize = activeSubdivision
    ? mapDims.baseCellSize / activeSubdivision.cellSizeRatio
    : 0;
  const previewStyle = PREVIEW_STYLE[tool];

  return (
    <div className={className} style={isActive ? { cursor } : undefined}>
      <Stage
        ref={stageRef}
        width={Math.max(1, viewportSize.width)}
        height={Math.max(1, viewportSize.height)}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
        listening={isActive}
        onMouseDown={events.onMouseDown}
        onMouseMove={events.onMouseMove}
        onMouseUp={events.onMouseUp}
        onMouseLeave={events.onMouseLeave}
        onContextMenu={events.onContextMenu}
        onTouchStart={events.onTouchStart}
        onTouchMove={events.onTouchMove}
        onTouchEnd={events.onTouchEnd}
      >
        {cellsBySub.map(({ sub, cells: subCells }) => (
          <Layer key={sub.id} listening={false}>
            {subCells.map((cell) => {
              const cellSize = cellSizeFor(sub);
              const piece = pieceById.get(cell.pieceId);
              const def = piece?.visualStates.find((v) => v.isDefault) ?? piece?.visualStates[0];
              const fallbackPath = def?.imagePath ?? '';
              const imagePath = resolveRenderImagePath(cell, fallbackPath, pieceById);
              const img = textureImages.get(imagePath);
              if (!img) return null;
              return (
                <KonvaImage
                  key={cell.id}
                  image={img}
                  x={cell.gridX * cellSize}
                  y={cell.gridY * cellSize}
                  width={cellSize}
                  height={cellSize}
                  perfectDrawEnabled={false}
                />
              );
            })}
          </Layer>
        ))}
        <Layer listening={false}>
          {previewCells.map((cell) => (
            <Rect
              key={`preview-${cell.gridX}-${cell.gridY}`}
              x={cell.gridX * previewCellSize}
              y={cell.gridY * previewCellSize}
              width={previewCellSize}
              height={previewCellSize}
              stroke={previewStyle.stroke}
              strokeWidth={1.5}
              fill={previewStyle.fill}
              perfectDrawEnabled={false}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

export const FloorCanvas = memo(FloorCanvasImpl, floorCanvasPropsAreEqual);
