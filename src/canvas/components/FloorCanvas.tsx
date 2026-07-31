'use client';

import type Konva from 'konva';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';
import { usePieceMap, useSubdivisionMap } from '@/hooks';
import { telemetry } from '@/lib/dev/perf';
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from '@/lib/shared/types';
import {
  type BrushCell,
  type BrushShape,
  type BrushSize,
  brushCellsAt,
  computeStrokeCells,
  type ToolKind,
} from '../tools';
import { findInteractiveCellAtPixel, getTrait } from '../traits';
import styles from './floor-canvas.module.css';

type MapDims = { baseCellSize: number; width: number; height: number };

type Props = {
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

/** Maps the floor's depth from active into a CSS tier class. Capped at
 *  tier3 — anything deeper uses the deepest tier style. */
function depthToTier(d: number): 0 | 1 | 2 | 3 {
  if (d <= 0) return 0;
  if (d === 1) return 1;
  if (d === 2) return 2;
  return 3;
}

/** Style tokens for the brush preview overlay. Kept local to avoid
 *  contaminating the global palette with paint-tool-specific colours. */
const PREVIEW_STYLE = {
  paint: { stroke: '#c9a86a', fill: 'rgba(201, 168, 106, 0.25)' },
  erase: { stroke: '#e07a7a', fill: 'rgba(224, 122, 122, 0.2)' },
} as const;

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
  // Last cell the stroke touched — used as the start point for line
  // interpolation on the next mousemove. Reset on stroke end and whenever
  // the cursor leaves the canvas.
  const lastStrokeCellRef = useRef<BrushCell | null>(null);
  // Throttle hover state updates to once per cell change so the preview
  // doesn't re-render the whole tree on every mouse-move tick.
  const [hoverCell, setHoverCell] = useState<BrushCell | null>(null);

  // Clear the brush preview when this floor stops being the active one
  // (e.g. user pressed Shift+ArrowUp with the cursor inside the canvas).
  // Without this the rect stays painted on the now-inactive floor until
  // the next mousemove / mouseleave fires — which may not happen if the
  // cursor is over the active floor above.
  useEffect(() => {
    if (!isActive) setHoverCell(null);
  }, [isActive]);

  // Render counter. Lives inside FloorCanvas (not in a wrapper) so React.memo
  // actually gates it: when the comparator returns true the useLayoutEffect
  // never runs and `recordRender` is never called. Previous design wrapped
  // this in `ProfiledTree` which re-ran on every parent render regardless
  // of memo outcome, producing inflated counts.
  //
  // `useLayoutEffect` fires synchronously after the DOM commit but BEFORE
  // paint. That makes the measured duration closer to actual render cost;
  // `useEffect` would bracket in the paint phase too, inflating the number
  // with browser paint work.
  //
  // NOTE on React 19 Strict Mode (default in dev only, not in `pnpm start`):
  // the mount effect runs twice (effect -> cleanup -> effect), which in
  // dev inflates the per-floor count by exactly +2 per logical mount
  // (Strict Mode's effect -> cleanup -> effect sequence runs the body
  // twice on mount). A `useRef(false)` guard previously caused
  // `renders: {}` in a snapshot because the ref persists across the
  // same instance lifetime and silently suppressed all subsequent
  // renders. Production runs (`pnpm start` is the main target of
  // this HUD) have Strict Mode off, so the count is exact there. The
  // +2 per mount in dev is the smaller evil.
  const renderStartRef = useRef(0);
  renderStartRef.current = performance.now();
  useLayoutEffect(() => {
    telemetry.recordRender(floor.id, performance.now() - renderStartRef.current);
  });

  const subById = useSubdivisionMap(subdivisions);
  const pieceById = usePieceMap(pieces);

  // Group cells by subdivision, dropping any whose subdivision is missing
  // from `subById` (defensive against a stale id after a config change),
  // then sort the buckets ascending by `subdivision.order`. Konva draws
  // children in DOM order, so the first Layer renders at the bottom and
  // each subsequent Layer paints over the previous one — matching the
  // z-stack declared on each subdivision config (Suelo=0 ... Estructuras=3).
  //
  // Pre-fix this map was implicit: cells rendered in insertion order, so
  // painting Suelo (z=0) on top of Objetos pequeños (z=2) at the same
  // position ended up hiding the higher layer — the new cell was appended
  // to the array and painted last by the single Layer.
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

  // Resolve the actual imagePath to render. Pieces with stateful traits
  // (e.g. doors) may override the visual state per cell.
  const resolveRenderImagePath = (cell: PaintedCell, fallbackPath: string): string => {
    const piece = pieceById.get(cell.pieceId);
    if (!piece) return fallbackPath;
    const trait = getTrait('door-states');
    if (!trait?.resolveTextureId) {
      const def = piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0];
      return def?.imagePath ?? fallbackPath;
    }
    return trait.resolveTextureId(cell, fallbackPath, piece);
  };

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
  const pointerToCell = useCallback(
    (pointer: { x: number; y: number }): BrushCell | null => {
      if (!activeSubdivision) return null;
      const gx = Math.floor(pointer.x / activeCellSize);
      const gy = Math.floor(pointer.y / activeCellSize);
      if (gx < 0 || gy < 0 || gx >= activeMaxX || gy >= activeMaxY) return null;
      return { gridX: gx, gridY: gy };
    },
    [activeSubdivision, activeCellSize, activeMaxX, activeMaxY],
  );

  // Paint stroke handler. Computes the brush footprint, interpolates
  // between the previous and current cell to keep fast drags continuous,
  // then forwards the resulting cell list to the parent.
  const apply = useCallback(
    (pointer: { x: number; y: number }, isDragging: boolean) => {
      const target = pointerToCell(pointer);
      if (!target) {
        // Out of bounds: clear the interpolation anchor but do not emit a
        // stroke. The user will pick up where they re-enter the canvas.
        lastStrokeCellRef.current = null;
        return;
      }
      const start = isDragging ? lastStrokeCellRef.current : null;
      const cells = computeStrokeCells(
        start,
        target,
        brushSize,
        { maxX: activeMaxX, maxY: activeMaxY },
        brushShape,
      );
      lastStrokeCellRef.current = target;

      if (tool === 'paint') {
        if (!activePieceId) return;
        onPaint?.(floor.id, activeSubdivisionId, cells, activePieceId);
      } else {
        onPaint?.(floor.id, activeSubdivisionId, cells, null);
      }
    },
    // `pointerToCell` closes over the same render-scope values, so it captures
    // every dependency the callback needs. Tracking only the underlying
    // values keeps the callback stable across renders that don't change them.
    [
      activeMaxX,
      activeMaxY,
      activePieceId,
      activeSubdivisionId,
      brushSize,
      brushShape,
      floor.id,
      onPaint,
      pointerToCell,
      tool,
    ],
  );

  // Update the preview hover cell. Only fires a state update when the cell
  // actually changes — moving the cursor inside the same cell is a no-op,
  // which keeps the Konva tree from re-rendering on every pointer tick.
  const updateHoverCell = (cell: BrushCell | null) => {
    setHoverCell((prev) => {
      if (!prev && !cell) return prev;
      if (prev && cell && prev.gridX === cell.gridX && prev.gridY === cell.gridY) return prev;
      return cell;
    });
  };

  const getPointer = (): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getRelativePointerPosition();
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isActive) return;
    // Right-click is reserved for opening trait menus (handleContextMenu);
    // it must not start a paint stroke or pan.
    if (e.evt.button === 2) return;
    // Left-click + space: pan.
    if (e.evt.button === 0 && isSpaceDown) {
      e.evt.preventDefault();
      beginPan(e.evt.clientX, e.evt.clientY);
      return;
    }
    // Left-click without space: paint or erase.
    if (e.evt.button === 0) {
      const pointer = getPointer();
      if (!pointer) return;
      apply(pointer, false);
      isDrawingRef.current = true;
    }
  };

  const handleMouseMove = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isActive) return;
    const pointer = getPointer();
    if (!pointer) return;
    // Always update the preview hover position, regardless of draw state —
    // the preview must be visible any time the cursor is over the canvas.
    updateHoverCell(pointerToCell(pointer));
    // Panning is handled by the window-level listener registered in the
    // viewport hook, so the cursor can leave the stage area without losing
    // the drag.
    if (isPanning) return;
    if (!isDrawingRef.current) return;
    apply(pointer, true);
  };

  const handlePointerUp = () => {
    if (!isActive) return;
    isDrawingRef.current = false;
    lastStrokeCellRef.current = null;
  };

  const handleMouseLeave = () => {
    if (!isActive) return;
    isDrawingRef.current = false;
    lastStrokeCellRef.current = null;
    updateHoverCell(null);
  };

  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!isActive) return;
    // Single-finger touch pans (consistent with desktop space+drag).
    const t = e.evt.touches[0];
    if (!t) return;
    e.evt.preventDefault();
    beginPan(t.clientX, t.clientY);
  };

  const handleTouchEnd = () => {
    if (!isActive) return;
    // Window-level touchend (registered by the hook) clears the drag ref.
  };

  /**
   * Right-click handler. Finds the topmost painted cell under the cursor
   * in world coords (so it works across subdivisions with different
   * `cellSizeRatio`) and, if that piece has an interactive trait (e.g.
   * door-states), opens its trait menu. Suppresses the browser's native
   * context menu.
   */
  const handleContextMenu = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isActive) return;
    e.evt.preventDefault();
    if (!onOpenTraitMenu) return;
    const pointer = getPointer();
    if (!pointer) return;
    const found = findInteractiveCellAtPixel({
      cells,
      floorId: floor.id,
      pixelX: pointer.x,
      pixelY: pointer.y,
      baseCellSize: mapDims.baseCellSize,
      subById,
      pieceById,
    });
    if (!found) return;
    onOpenTraitMenu(found.cell.id, found.trait.kind, {
      x: e.evt.clientX,
      y: e.evt.clientY,
    });
  };

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
    // We intentionally depend on hoverCell (the throttled state value), not
    // the raw pointer, so re-renders are bounded by cell changes.
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchEnd}
        onTouchEnd={handleTouchEnd}
      >
        {cellsBySub.map(({ sub, cells: subCells }) => (
          <Layer key={sub.id} listening={false}>
            {subCells.map((cell) => {
              const cellSize = cellSizeFor(sub);
              const piece = pieceById.get(cell.pieceId);
              const def = piece?.visualStates.find((v) => v.isDefault) ?? piece?.visualStates[0];
              const fallbackPath = def?.imagePath ?? '';
              const imagePath = resolveRenderImagePath(cell, fallbackPath);
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

/**
     * Content-equality check for `PaintedCell[]` props. Used by the custom
     * `memo` comparator below to fix a known re-render storm in the layer
     * stack: every paint rebuilds the per-floor bucket in `FloorStack`, so
     * `cells` arrives here with a new reference even when its content is
     * identical. The default `memo` shallow compare then invalidates the
     * FloorCanvas and re-renders the inactive floors unnecessarily. We compare
     * the visible fields of each cell (id, piece, position, subdivision) so
     * unrelated state changes do not force a re-render.
     */
    /**
     * Shallow-equal for `entityState` records. Trait-menu changes
     * (e.g. door-states: closed -> open) mutate only this field on
     * a single cell; the comparator MUST detect that change or the
     * FloorCanvas memo will skip the render and the door texture
     * stays stale until an unrelated event forces a re-render.
     * `null` and `undefined` are both treated as the empty state.
     */
    function entityStatesEqual(
      a: Record<string, string | number | boolean> | undefined,
      b: Record<string, string | number | boolean> | undefined,
    ): boolean {
      if (a === b) return true;
      // `noUncheckedIndexedAccess` makes `a[k]` `T | undefined`. Narrow with
      // `b[k]`-aware check: if `b` is missing, the loop already short-circuits.
      const ak = a ? Object.keys(a) : [];
      const bk = b ? Object.keys(b) : [];
      if (ak.length !== bk.length) return false;
      const bNonNull = b as Record<string, string | number | boolean>;
      const aNonNull = a as Record<string, string | number | boolean>;
      for (const k of ak) {
        if (aNonNull[k] !== bNonNull[k]) return false;
      }
      return true;
    }

    /**
         * Content-equality check for `PaintedCell[]` props. Used by the custom
         * `memo` comparator below to fix a known re-render storm in the layer
         * stack: every paint rebuilds the per-floor bucket in `FloorStack`, so
         * `cells` arrives here with a new reference even when its content is
         * identical. The default `memo` shallow compare then invalidates the
         * FloorCanvas and re-renders the inactive floors unnecessarily. We compare
         * the visible fields of each cell (id, piece, position, subdivision,
         * and entity state via the helper above) so unrelated state changes
         * do not force a re-render.
         */
    function cellsContentEqual(a: PaintedCell[], b: PaintedCell[]): boolean {
      if (a === b) return true;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        const x = a[i];
        const y = b[i];
        if (!x || !y) return false;
        if (x.id !== y.id) return false;
        if (x.floorId !== y.floorId) return false;
        if (x.subdivisionId !== y.subdivisionId) return false;
        if (x.pieceId !== y.pieceId) return false;
        if (x.gridX !== y.gridX) return false;
        if (x.gridY !== y.gridY) return false;
        if (!entityStatesEqual(x.entityState, y.entityState)) return false;
      }
      return true;
    }

    /**
     * Custom comparator for `React.memo`. Most props are already reference-stable
     * (state objects, useCallback handlers, primitive zoom/pan). The notable
     * exception is `cells`, which the parent re-buckets on every paintedCells
     * change — see `cellsContentEqual`. All other props are checked by reference
     * identity because the editor only passes the same object when nothing in
     * that prop has changed.
     */
    function floorCanvasPropsAreEqual(prev: Props, next: Props): boolean {
      if (process.env.NODE_ENV !== 'production') {
        // Dev-only diagnostic: an inactive floor (one rendered below the
        // active one) should never re-render unless its `cells` actually
        // change or a few legitimately-global props change. If it does
        // for any other reason, the comparator above will have caught it
        // (via `cellsContentEqual` or any of the other shallow checks), and
        // a `console.warn` below tells the developer exactly which prop
        // was non-stable — usually a callback or object reference captured
        // from a closure that was recreated by a `useCallback` deps list
        // that doesn't match the parent's render cycle. This is the
        // signal that "FloorCanvas memo is broken" — the cause of the
        // original lag-with-many-floors regression.
        //
        // Skipped in production so the warn is dead-code-eliminated.
        // We only fire for INACTIVE floors because the active floor
        // legitimately re-renders on every prop change.
        //
        // Why we exclude some props from the warn:
        //   - pan / zoom / viewportSize: viewport state is shared by every
        //     floor. When the user zooms or pans, every Stage needs to
        //     reposition its content — including inactive floors — so the
        //     re-render is legitimate.
        //   - depthFromActive / isActive: when the user switches which
        //     floor is active, every other floor changes its relative
        //     depth and the blur/depth styling has to update. Also
        //     legitimate.
        //   - floor / cells / mapDims: the comparator's whole job is to
        //     re-render when these change, so re-rendering because of them
        //     is the success case, not the bug case.
        if (!prev.isActive) {
          const changes: string[] = [];
          if (prev.subdivisions !== next.subdivisions) changes.push('subdivisions');
          if (prev.pieces !== next.pieces) changes.push('pieces');
          if (prev.textureImages !== next.textureImages) changes.push('textureImages');
          if (prev.activeSubdivisionId !== next.activeSubdivisionId) changes.push('activeSubdivisionId');
          if (prev.activePieceId !== next.activePieceId) changes.push('activePieceId');
          if (prev.tool !== next.tool) changes.push('tool');
          if (prev.brushSize !== next.brushSize) changes.push('brushSize');
          if (prev.brushShape !== next.brushShape) changes.push('brushShape');
          if (prev.beginPan !== next.beginPan) changes.push('beginPan');
          if (prev.isSpaceDown !== next.isSpaceDown) changes.push('isSpaceDown');
          if (prev.isPanning !== next.isPanning) changes.push('isPanning');
          if (prev.onPaint !== next.onPaint) changes.push('onPaint');
          if (prev.onOpenTraitMenu !== next.onOpenTraitMenu) changes.push('onOpenTraitMenu');
          if (changes.length > 0) {
            // eslint-disable-next-line no-console
            console.warn(
              `[FloorCanvas INACTIVE "${prev.floor.name}"] re-rendering due to: ${changes.join(', ')}`,
            );
          }
        }
      }
      return (
        prev.floor === next.floor &&
        cellsContentEqual(prev.cells, next.cells) &&
        prev.depthFromActive === next.depthFromActive &&
        prev.isActive === next.isActive &&
        prev.mapDims === next.mapDims &&
        prev.subdivisions === next.subdivisions &&
        prev.pieces === next.pieces &&
        prev.activeSubdivisionId === next.activeSubdivisionId &&
        prev.activePieceId === next.activePieceId &&
        prev.tool === next.tool &&
        prev.brushSize === next.brushSize &&
        prev.brushShape === next.brushShape &&
        prev.textureImages === next.textureImages &&
        prev.viewportSize === next.viewportSize &&
        prev.pan === next.pan &&
        prev.zoom === next.zoom &&
        prev.beginPan === next.beginPan &&
        prev.isSpaceDown === next.isSpaceDown &&
        prev.isPanning === next.isPanning &&
        prev.onPaint === next.onPaint &&
        prev.onOpenTraitMenu === next.onOpenTraitMenu
      );
    }

    export const FloorCanvas = memo(FloorCanvasImpl, floorCanvasPropsAreEqual);
