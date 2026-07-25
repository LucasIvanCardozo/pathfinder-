"use client";

import type Konva from "konva";
import { memo, useCallback, useMemo, useRef } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import type { Door, Floor, PaintedCell, SubdivisionConfig, Texture } from "@/pieces";
import { useTextureImages } from "../useTextureImages";
import { doorStateToTextureId } from "../doorTexture";
import { GridLayer } from "./GridLayer";
import type { PaintTool } from "./PaintToolbar";

export type ScreenPos = { x: number; y: number };

type Props = {
  floors: Floor[];
  activeFloorId: string;
  subdivisions: SubdivisionConfig[];
  paintedCells: PaintedCell[];
  doors: Door[];
  textures: Texture[];
  activeSubdivisionId: string;
  activeTextureId: string | null;
  tool: PaintTool;
  onPaint: (
    floorId: string,
    subdivisionId: string,
    gridX: number,
    gridY: number,
    textureId: string | null,
    screenPos: ScreenPos | null,
    isDragging: boolean,
  ) => void;
  width?: number;
  height?: number;
};

type RenderItem =
  | { kind: "cell"; z: number; cell: PaintedCell; sub: SubdivisionConfig }
  | { kind: "door"; z: number; door: Door };

function PaintCanvasImpl({
  floors,
  activeFloorId,
  subdivisions,
  paintedCells,
  doors,
  textures,
  activeSubdivisionId,
  activeTextureId,
  tool,
  onPaint,
  width = 1200,
  height = 800,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const isDrawingRef = useRef(false);

  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0]!;

  const stageNativeWidth = activeFloor.width * activeFloor.baseCellSize;
  const stageNativeHeight = activeFloor.height * activeFloor.baseCellSize;
  const scaleX = width / stageNativeWidth;
  const scaleY = height / stageNativeHeight;

  const textureImages = useTextureImages(textures);

  // Subdivisions sorted by `order` for deterministic Z layering.
  const sortedSubs = useMemo(
    () => [...subdivisions].sort((a, b) => a.order - b.order),
    [subdivisions],
  );

  const subById = useMemo(() => {
    const m = new Map<string, SubdivisionConfig>();
    for (const sub of sortedSubs) m.set(sub.id, sub);
    return m;
  }, [sortedSubs]);

  const activeIndex = floors.findIndex((f) => f.id === activeFloorId);

  // Flat list of cells + doors, all ordered by Z. Z = floorIndex * subCount +
  // sub.order. Doors are treated as a virtual subdivision sitting one slot
  // above the highest subdivision (so they're always on top of walls but
  // can still be occluded by doors in higher floors). Only items from the
  // active floor and the floors BELOW it are rendered.
  const itemsByZ = useMemo(() => {
    if (activeIndex < 0) return [];
    const subCount = sortedSubs.length;
    // Doors are conceptually one slot above the topmost subdivision.
    // Doors sit between cells of the same floor and cells of the next floor
    // up, so they always render below any cell painted on a higher floor
    // (and above any cell painted on the same or lower floor). The -0.5
    // avoids Z-ties with Suelo (sub.order=0) cells on the floor above.
    const doorSubOrder = subCount - 0.5;
    const items: RenderItem[] = [];

    // Painted cells
    for (let fIdx = 0; fIdx <= activeIndex; fIdx++) {
      const floor = floors[fIdx]!;
      for (const cell of paintedCells) {
        if (cell.floorId !== floor.id) continue;
        const sub = subById.get(cell.subdivisionId);
        if (!sub) continue;
        items.push({ kind: "cell", z: fIdx * subCount + sub.order, cell, sub });
      }
    }

    // Doors (live on the base grid, Z = floorIndex * subCount + doorSubOrder)
    for (let fIdx = 0; fIdx <= activeIndex; fIdx++) {
      const floor = floors[fIdx]!;
      for (const door of doors) {
        if (door.floorId !== floor.id) continue;
        items.push({ kind: "door", z: fIdx * subCount + doorSubOrder, door });
      }
    }

    items.sort((a, b) => a.z - b.z);
    return items;
  }, [floors, paintedCells, doors, sortedSubs, subById, activeIndex]);

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

      const textureId = tool === "paint" ? activeTextureId : null;
      if (tool === "paint" && !textureId) return;
      onPaint(
        activeFloor.id,
        activeSubdivisionId,
        gridX,
        gridY,
        textureId,
        { x: clientX, y: clientY },
        isDragging,
      );
    },
    [
      activeTextureId,
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
  ): { x: number; y: number } | null => {
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

  return (
    <div className="paint-canvas-container" style={{ width, height }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={scaleX}
        scaleY={scaleY}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
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

        {/*
          Single Layer with every cell AND door, sorted by Z. Z = floorIndex *
          subCount + sub.order (or + doorSubOrder for doors). Lower Z renders
          first (behind); higher Z renders on top. A door on the active floor
          occludes everything below it at the same position; a door on a lower
          floor is occluded by any cell on the active floor at that position.
        */}
        <Layer listening={false}>
          {itemsByZ.map((item) => {
            if (item.kind === "cell") {
              const cellSize = activeFloor.baseCellSize / item.sub.cellSizeRatio;
              const img = textureImages.get(item.cell.textureId);
              if (!img) return null;
              return (
                <KonvaImage
                  key={`c-${item.cell.id}`}
                  image={img}
                  x={item.cell.gridX * cellSize}
                  y={item.cell.gridY * cellSize}
                  width={cellSize}
                  height={cellSize}
                  perfectDrawEnabled={false}
                />
              );
            }
            // door
            const img = textureImages.get(doorStateToTextureId(item.door.state));
            if (!img) return null;
            return (
              <KonvaImage
                key={`d-${item.door.id}`}
                image={img}
                x={item.door.gridX * activeFloor.baseCellSize}
                y={item.door.gridY * activeFloor.baseCellSize}
                width={activeFloor.baseCellSize}
                height={activeFloor.baseCellSize}
                perfectDrawEnabled={false}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}

export const PaintCanvas = memo(PaintCanvasImpl);
