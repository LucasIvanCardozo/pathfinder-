"use client";

import { Fragment, memo, useCallback, useMemo, useRef } from "react";
import { Image as KonvaImage, Layer, Rect, Stage } from "react-konva";
import type Konva from "konva";
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from "@/lib/shared/types";
import { findInteractiveCellAtPixel, getTrait } from "../traits";
import { useTextureImages, type BlurTier } from "../useTextureImages";
import styles from "./PaintCanvas.module.css";
import { GridLayer } from "./GridLayer";

// Depth-based visual effects applied to cells on floors below the active one.
const DEPTH_EFFECTS = { darken: true, scale: true } as const;
const DARKEN_PER_TIER = 0.2;
const SCALE_PER_TIER = 0;

type Props = {
  floors: Floor[];
  activeFloorId: string;
  subdivisions: SubdivisionConfig[];
  paintedCells: PaintedCell[];
  pieces: Piece[];
  activeSubdivisionId: string;
  activePieceId: string | null;
  tool: "paint" | "erase";
  onPaint: (
    floorId: string,
    subdivisionId: string,
    gridX: number,
    gridY: number,
    pieceId: string | null,
    screenPos: { x: number; y: number } | null,
    isDragging: boolean,
  ) => void;
  /**
   * Called when the user right-clicks a painted cell that has an
   * interactive trait (e.g. door-states). Opens the cell's trait
   * menu at the supplied screen position.
   */
  onOpenTraitMenu?: (
    cellId: string,
    traitKind: string,
    screenPos: { x: number; y: number },
  ) => void;
  /** Optional overlay rendered inside the paint container, after the
   *  Stage. Used e.g. by the weather overlay so it fills the same
   *  fixed-size container as the Konva stage. */
  overlay?: React.ReactNode;
};

type ScreenPos = { x: number; y: number };

function PaintCanvasImpl({
  floors,
  activeFloorId,
  subdivisions,
  paintedCells,
  pieces,
  activeSubdivisionId,
  activePieceId,
  tool,
  onPaint,
  onOpenTraitMenu,
  overlay,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const isDrawingRef = useRef(false);

  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0]!;

  const stageNativeWidth = activeFloor.width * activeFloor.baseCellSize;
  const stageNativeHeight = activeFloor.height * activeFloor.baseCellSize;
  // Stage is exactly the grid's native pixel size. Cells render at 1:1
  // (no scaling), the container scrolls when the grid overflows the
  // viewport, and the mouse mapping is pixel-perfect.
  const stageWidth = stageNativeWidth;
  const stageHeight = stageNativeHeight;

  const allImagePaths = useMemo(() => {
    const set = new Set<string>();
    for (const p of pieces) {
      for (const v of p.visualStates) set.add(v.imagePath);
    }
    return Array.from(set);
  }, [pieces]);

  const textureImages = useTextureImages(allImagePaths);

  const sortedSubs = useMemo(
    () => [...subdivisions].sort((a, b) => a.order - b.order),
    [subdivisions],
  );

  const subById = useMemo(() => {
    const m = new Map<string, SubdivisionConfig>();
    for (const sub of sortedSubs) m.set(sub.id, sub);
    return m;
  }, [sortedSubs]);

  const pieceById = useMemo(() => {
    const m = new Map<string, Piece>();
    for (const p of pieces) m.set(p.id, p);
    return m;
  }, [pieces]);

  const activeIndex = floors.findIndex((f) => f.id === activeFloorId);
  const subCount = sortedSubs.length;

  const blurTierFor = (cellFloorIdx: number): BlurTier => {
    const depth = activeIndex - cellFloorIdx;
    if (depth <= 0) return 0;
    if (depth === 1) return 1;
    if (depth === 2) return 2;
    return 3;
  };

  const resolveRenderImagePath = (cell: PaintedCell, fallbackPath: string): string => {
    const piece = pieceById.get(cell.pieceId);
    if (!piece) return fallbackPath;
    const trait = getTrait("door-states");
    if (!trait?.resolveTextureId) {
      const def = piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0];
      return def?.imagePath ?? fallbackPath;
    }
    return trait.resolveTextureId(cell, fallbackPath, piece);
  };

  const itemsByZ = useMemo(() => {
    if (activeIndex < 0) return [];
    const items: { z: number; cell: PaintedCell; sub: SubdivisionConfig }[] = [];
    for (let fIdx = 0; fIdx <= activeIndex; fIdx++) {
      const floor = floors[fIdx]!;
      for (const cell of paintedCells) {
        if (cell.floorId !== floor.id) continue;
        const sub = subById.get(cell.subdivisionId);
        if (!sub) continue;
        items.push({ z: fIdx * subCount + sub.order, cell, sub });
      }
    }
    items.sort((a, b) => a.z - b.z);
    return items;
  }, [floors, paintedCells, subById, activeIndex, subCount]);

  const apply = useCallback(
    (clientX: number, clientY: number, isDragging: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      const xInContainer = clientX - rect.left;
      const yInContainer = clientY - rect.top;
      const nativeX = (xInContainer / rect.width) * stageNativeWidth;
      const nativeY = (yInContainer / rect.height) * stageNativeHeight;

      const sub = subById.get(activeSubdivisionId);
      if (!sub) return;
      const cellSize = activeFloor.baseCellSize / sub.cellSizeRatio;
      const maxX = activeFloor.width * sub.cellSizeRatio;
      const maxY = activeFloor.height * sub.cellSizeRatio;
      const gridX = Math.floor(nativeX / cellSize);
      const gridY = Math.floor(nativeY / cellSize);
      if (gridX < 0 || gridY < 0 || gridX >= maxX || gridY >= maxY) return;

      const pieceId = tool === "paint" ? activePieceId : null;
      if (tool === "paint" && !pieceId) return;
      onPaint(
        activeFloor.id,
        activeSubdivisionId,
        gridX,
        gridY,
        pieceId,
        { x: clientX, y: clientY },
        isDragging,
      );
    },
    [
      activePieceId,
      activeSubdivisionId,
      activeFloor,
      onPaint,
      subById,
      tool,
      stageNativeWidth,
      stageNativeHeight,
    ],
  );

  const getEventCoords = (
    e: Konva.KonvaEventObject<MouseEvent> | Konva.KonvaEventObject<TouchEvent>,
  ): ScreenPos | null => {
    const evt = e.evt as MouseEvent & { touches?: TouchList };
    if (typeof evt.clientX === "number" && typeof evt.clientY === "number") {
      return { x: evt.clientX, y: evt.clientY };
    }
    if (evt.touches && evt.touches.length > 0) {
      const t = evt.touches[0]!;
      return { x: t.clientX, y: t.clientY };
    }
    return null;
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Right-click is reserved for opening trait menus (see handleContextMenu);
    // it must not start a paint stroke.
    if (e.evt.button === 2) return;
    const coords = getEventCoords(e);
    if (!coords) return;
    apply(coords.x, coords.y, false);
    isDrawingRef.current = true;
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawingRef.current) return;
    const coords = getEventCoords(e);
    if (!coords) return;
    apply(coords.x, coords.y, true);
  };

  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const coords = getEventCoords(e);
    if (!coords) return;
    apply(coords.x, coords.y, false);
    isDrawingRef.current = true;
  };

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (!isDrawingRef.current) return;
    const coords = getEventCoords(e);
    if (!coords) return;
    apply(coords.x, coords.y, true);
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  /**
   * Right-click handler. Finds the topmost painted cell under the cursor
   * in pixel space (so it works across subdivisions with different
   * cellSizeRatio) and, if that piece has an interactive trait (e.g.
   * door-states), opens its trait menu. Suppresses the browser's native
   * context menu.
   */
  const handleContextMenu = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    const coords = getEventCoords(e);
    if (!coords || !onOpenTraitMenu) return;
    const stage = stageRef.current;
    if (!stage) return;

    // Map mouse viewport coords to the canvas's internal pixel space.
    // `getBoundingClientRect()` already accounts for parent scrolling.
    const rect = stage.container().getBoundingClientRect();
    const pixelX = coords.x - rect.left;
    const pixelY = coords.y - rect.top;

    const found = findInteractiveCellAtPixel({
      cells: paintedCells,
      floorId: activeFloor.id,
      pixelX,
      pixelY,
      baseCellSize: activeFloor.baseCellSize,
      subById,
      pieceById,
    });
    if (!found) return;

    onOpenTraitMenu(found.cell.id, found.trait.kind, { x: coords.x, y: coords.y });
  };

  return (
    <div className={styles.canvas} style={{ width: stageWidth, height: stageHeight }}>
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handlePointerUp}
      >
        <GridLayer
          config={{
            baseCellSize: activeFloor.baseCellSize,
            width: activeFloor.width,
            height: activeFloor.height,
          }}
        />

        <Layer listening={false}>
          {itemsByZ.map((item) => {
            const cellSize = activeFloor.baseCellSize / item.sub.cellSizeRatio;
            const piece = pieceById.get(item.cell.pieceId);
            const def = piece?.visualStates.find((v) => v.isDefault) ?? piece?.visualStates[0];
            const fallbackPath = def?.imagePath ?? "";
            const imagePath = resolveRenderImagePath(item.cell, fallbackPath);
            const variants = textureImages.get(imagePath);
            if (!variants) return null;
            const cellFloorIdx = Math.floor(item.z / subCount);
            const tier = blurTierFor(cellFloorIdx);
            const img = variants[tier];
            const scale = DEPTH_EFFECTS.scale ? 1 - tier * SCALE_PER_TIER : 1;
            const offset = (cellSize * (1 - scale)) / 2;
            return (
              <Fragment key={`c-${item.cell.id}`}>
                <KonvaImage
                  image={img}
                  x={item.cell.gridX * cellSize + offset}
                  y={item.cell.gridY * cellSize + offset}
                  width={cellSize}
                  height={cellSize}
                  scaleX={scale}
                  scaleY={scale}
                  perfectDrawEnabled={false}
                />
                {DEPTH_EFFECTS.darken && tier > 0 ? (
                  <Rect
                    x={item.cell.gridX * cellSize}
                    y={item.cell.gridY * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill="rgba(0,0,0,1)"
                    opacity={tier * DARKEN_PER_TIER}
                    listening={false}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </Layer>
      </Stage>
      {overlay}
    </div>
  );
}
export const PaintCanvas = memo(PaintCanvasImpl);