'use client';

import type Konva from 'konva';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';
import { telemetry } from '@/dev/perf/telemetry';
import { usePieceMap, useSubdivisionMap } from '@/hooks';
import type {
  Floor,
  PaintedCell,
  Piece,
  SubdivisionConfig,
} from '@/lib/shared/types';
import type { BrushCell, BrushShape, BrushSize, StrokeFootprint, ToolKind } from '../tools';
import { brushCellsAt } from '../tools';
import { floorCanvasPropsAreEqual } from './floor-canvas/comparators';
import { depthToTier } from './floor-canvas/depthToTier';
import { pointerToCell } from './floor-canvas/pointerToCell';
import { PREVIEW_STYLE } from './floor-canvas/previewStyle';
import { resolveRenderImagePath } from './floor-canvas/resolveRenderImagePath';
import { useCanvasEventHandlers } from './floor-canvas/useCanvasEventHandlers';
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
  darknessMode: 'apply' | 'erase';
  /** Brush footprint in active-subdivision cells. Always odd; size 1 = single cell. */
  brushSize: BrushSize;
  /** Geometric shape of the brush footprint (circle vs. square). Propagated
   *  through `computeStrokeCells` so the painter and the hover preview
   *  agree on the same footprint. */
  brushShape: BrushShape;
  /** When false, skip rendering the brush footprint preview Layer. Defaults
   *  to true so the prop is optional and existing callers don't have to
   *  change. Toggled by the editor's `toggleBrushPreview` shortcut. */
  showBrushPreview?: boolean;
  /** Loaded texture images keyed by `imagePath`. One HTMLImageElement per path
   *  — depth blur is now done in CSS. */
  textureImages: Map<string, HTMLImageElement>;
  viewportSize: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
  /** Begin a pan drag (from the viewport hook). */
  beginPan: (clientX: number, clientY: number) => void;
  isPanDown: boolean;
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
  /**
   * Called when the darkness tool is in erase mode. Receives one stamp per
   * Bresenham step so the owner can BFS from each `centre` with structure
   * cells as propagation walls. Coordinates only — the owner looks up
   * matching darkness cell ids.
   */
  onDarknessErase?: (floorId: string, footprints: StrokeFootprint[]) => void;
  /** ONLY attached when `isActive`. Opens an interactive trait menu (e.g.
   *  door-states right-click). */
  onOpenTraitMenu?: (
    cellId: string,
    traitKind: string,
    screenPos: { x: number; y: number },
  ) => void;
  /**
   * Fired when the user clicks an effect marker. PR 2 surfaces this
   * so the tooltip can open; FloorStack forwards it. Optional.
   */
  onMarkerClick?: (effectId: string, screenPos: { x: number; y: number }) => void;
  /**
   * Fired when the user clicks an empty cell with the effects tool
   * active. PR 2 wires the anchor picker; FloorStack forwards it.
   */
  onAnchorClick?: (cell: { gridX: number; gridY: number }) => void;
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
  darknessMode,
  brushSize,
  brushShape,
  showBrushPreview = true,
  textureImages,
  viewportSize,
  pan,
  zoom,
  beginPan,
  isPanDown,
  isPanning,
  onPaint,
  onDarknessErase,
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

  // Bucket cells by subdivision, then always emit one entry per subdivision
  // sorted by `order`. Empty cell arrays for subdivisions with no painted
  // cells — the Layer still renders (Konva creates its <canvas>) so the
  // DOM structure is predictable and the per-subdivision `:nth-child`
  // selectors in floor-canvas.module.css stay stable.
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
    const ordered = subdivisions.slice().sort((a, b) => a.order - b.order);
    return ordered.map((sub) => ({
      sub,
      cells: buckets.get(sub.id) ?? [],
    }));
  }, [cells, subdivisions]);

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
        onDarknessErase: onDarknessErase ?? (() => {}),
        pointerToCell: pointerToCellLocal,
        tool,
        darknessMode,
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
      onDarknessErase,
      pointerToCellLocal,
      tool,
      darknessMode,
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
    isPanDown,
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
    // PR 2: forward `tool` and `onAnchorClick` so the handler can dispatch
    // on `tool === 'effects'` (open the modal pre-filled with the click
    // coordinates) instead of falling through to the paint branch.
    // PR 1 did not wire these, so the paint branch ran even when the
    // effects tool was active — the user saw nothing happen on click.
    tool,
  });

  // Cursor reflects the current interaction: default crosshair (paint),
  // grab when space is held, grabbing while a pan drag is in progress.
  const baseCursor = tool === 'erase' ? 'cell' : 'crosshair';
  const cursor = isPanDown ? (isPanning ? 'grabbing' : 'grab') : baseCursor;

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

  // Always-visible, non-interactive brush preview. Renders one filled
  // rect per cell in the brush footprint at the current hover position,
  // with no stroke so adjacent cells don't draw an interior grid line.
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
        {/*
          Effects overlay — wrapped in a <Konva.Group> per effect. The
          Layer sits BETWEEN the paintable subdivisions (suelo/og/op/
          estructuras) and `obscured` so a fireball is visible on top of
          walls but hidden by a darkness overlay. The Konva.Group
          collapses each effect into one draw call. Cap 0.7 still
          applies (post-render alpha).
        */}
        {cellsBySub
          .filter(({ sub }) => sub.id !== 'obscured')
          .map(({ sub, cells: subCells }) => {
            // PR 2: render every paintable subdivision (suelo, og, op,
            // so a fireball is visible on top of walls/structures but
            // hidden by a darkness overlay painted with the lunar tool.
            // FloorCanvas.module.css keys the drop-shadow/blur per canvas
            // by `:nth-child(N)` — keep this block at positions 1-4.
            const cellSize = cellSizeFor(sub);
            return (
              <Layer key={sub.id} listening={false}>
                {subCells.map((cell) => {
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
            );
          })}
        {cellsBySub
          .filter(({ sub }) => sub.id === 'obscured')
          .map(({ sub, cells: subCells }) => {
            // Darkness overlay: solid black rects. No texture, no piece
            // lookup — the renderer dispatches on subdivisionId and
            // ignores `pieceId` (which holds the sentinel `DARKNESS_PIECE_ID`
            // string). `listening={false}` so darkness cells never block
            // hit tests for the pieces underneath. Renders AFTER the
            // effects Layer so a darkness spell hides any AoE marker it
            // covers (the marker still exists in the state but is
            // occluded by the black rect).
            const cellSize = cellSizeFor(sub);
            return (
              <Layer key={sub.id} listening={false}>
                {subCells.map((cell) => (
                  <Rect
                    key={cell.id}
                    x={cell.gridX * cellSize}
                    y={cell.gridY * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill="black"
                    perfectDrawEnabled={false}
                  />
                ))}
              </Layer>
            );
          })}
        {showBrushPreview && (
          <Layer listening={false}>
            {previewCells.map((cell) => (
              <Rect
                key={`preview-${cell.gridX}-${cell.gridY}`}
                x={cell.gridX * previewCellSize}
                y={cell.gridY * previewCellSize}
                width={previewCellSize}
                height={previewCellSize}
                fill={previewStyle.fill}
                perfectDrawEnabled={false}
                listening={false}
              />
            ))}
          </Layer>
        )}
      </Stage>
    </div>
  );
}

export const FloorCanvas = memo(FloorCanvasImpl, floorCanvasPropsAreEqual);
