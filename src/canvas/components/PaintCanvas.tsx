"use client";

import type Konva from "konva";
import { memo, useCallback, useMemo, useRef } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import type { Door, Floor, PaintedCell, SubdivisionConfig, Texture } from "@/pieces";
import { useTextureImages } from "../useTextureImages";
import { DoorLayer } from "./DoorLayer";
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

  // Flat list of painted cells, ordered by Z = floorIndex * subCount + sub.order.
  // Only cells from the active floor and the floors BELOW it are rendered —
  // when you stand on PB you don't see what was painted on Piso 1 or Piso 2.
  const cellsByZ = useMemo(() => {
    if (activeIndex < 0) return [];
    const subCount = sortedSubs.length;
    type Item = { z: number; cell: PaintedCell; sub: SubdivisionConfig };
    const items: Item[] = [];
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
  }, [floors, paintedCells, sortedSubs, subById, activeIndex]);

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
          Single Layer with every painted cell, sorted by Z. Z = floorIndex *
          subCount + sub.order. Lower Z renders first (behind); higher Z renders
          on top. A floor painted on a higher floor correctly occludes the
          cells of any lower floor at the same position, regardless of
          subdivision.
        */}
        <Layer listening={false}>
          {cellsByZ.map(({ cell, sub }) => {
            const cellSize = activeFloor.baseCellSize / sub.cellSizeRatio;
            const img = textureImages.get(cell.textureId);
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

        {/* Doors layer — only the active floor's doors, not cascaded. */}
        <DoorLayer
          doors={doors.filter((d) => d.floorId === activeFloor.id)}
          cellSize={activeFloor.baseCellSize}
          baseTextures={textures}
        />
      </Stage>
    </div>
  );
}

export const PaintCanvas = memo(PaintCanvasImpl);
