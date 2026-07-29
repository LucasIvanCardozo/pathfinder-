'use client';

import { memo, useCallback, useRef } from 'react';
import { Image as KonvaImage, Layer, Stage } from 'react-konva';
import type Konva from 'konva';
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from '@/lib/shared/types';
import { usePieceMap, useSubdivisionMap } from '@/hooks';
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
  subdivisions: SubdivisionConfig[];
  pieces: Piece[];
  activeSubdivisionId: string;
  activePieceId: string | null;
  tool: 'paint' | 'erase';
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
  /** ONLY attached when `isActive`. */
  onPaint?: (
    floorId: string,
    subdivisionId: string,
    gridX: number,
    gridY: number,
    pieceId: string | null,
    screenPos: { x: number; y: number } | null,
    isDragging: boolean,
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

  const subById = useSubdivisionMap(subdivisions);
  const pieceById = usePieceMap(pieces);

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

  // Paint stroke handler. Pointer coords are in WORLD coords (Konva's
  // `getRelativePointerPosition` accounts for the stage transform).
  const apply = useCallback(
    (pointer: { x: number; y: number }, isDragging: boolean) => {
      const sub = subById.get(activeSubdivisionId);
      if (!sub) return;
      const cellSize = mapDims.baseCellSize / sub.cellSizeRatio;
      const maxX = mapDims.width * sub.cellSizeRatio;
      const maxY = mapDims.height * sub.cellSizeRatio;
      const gridX = Math.floor(pointer.x / cellSize);
      const gridY = Math.floor(pointer.y / cellSize);
      if (gridX < 0 || gridY < 0 || gridX >= maxX || gridY >= maxY) return;

      const pieceId = tool === 'paint' ? activePieceId : null;
      if (tool === 'paint' && !pieceId) return;
      onPaint?.(floor.id, activeSubdivisionId, gridX, gridY, pieceId, null, isDragging);
    },
    [
      activePieceId,
      activeSubdivisionId,
      floor.id,
      mapDims.baseCellSize,
      mapDims.width,
      mapDims.height,
      onPaint,
      subById,
      tool,
    ],
  );

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
    // Panning is handled by the window-level listener registered in the
    // viewport hook, so the cursor can leave the stage area without losing
    // the drag.
    if (isPanning) return;
    if (!isDrawingRef.current) return;
    const pointer = getPointer();
    if (!pointer) return;
    apply(pointer, true);
  };

  const handlePointerUp = () => {
    if (!isActive) return;
    isDrawingRef.current = false;
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
        onMouseLeave={handlePointerUp}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchEnd}
        onTouchEnd={handleTouchEnd}
      >
        <Layer listening={false}>
          {cells.map((cell) => {
            const sub = subById.get(cell.subdivisionId);
            if (!sub) return null;
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
      </Stage>
    </div>
  );
}

export const FloorCanvas = memo(FloorCanvasImpl);
