"use client";

import { Stage, Layer, Image as KonvaImage, Rect } from "react-konva";
import { memo, useCallback, useRef } from "react";
import type Konva from "konva";
import type { Floor, PaintedCell, Texture, SubdivisionConfig, Door } from "@/pieces";
import { GridLayer } from "./GridLayer";
import { DoorLayer } from "./DoorLayer";
import { useTextureImages } from "../useTextureImages";
import type { PaintTool } from "./PaintToolbar";

export type ScreenPos = { x: number; y: number };

type Props = {
  floor: Floor;
  subdivisions: SubdivisionConfig[];
  paintedCells: PaintedCell[];
  doors: Door[];
  textures: Texture[];
  activeSubdivisionId: string;
  activeTextureId: string | null;
  tool: PaintTool;
  /**
   * Called when the user clicks/drags a cell. The screenPos lets the
   * caller position UI (e.g. the door menu) near the cursor.
   */
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
  floor,
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

  const stageNativeWidth = floor.width * floor.baseCellSize;
  const stageNativeHeight = floor.height * floor.baseCellSize;
  const scaleX = width / stageNativeWidth;
  const scaleY = height / stageNativeHeight;

  const textureImages = useTextureImages(textures);

  // Subdivisions sorted by `order` for deterministic layering.
  const sortedSubs = [...subdivisions].sort((a, b) => a.order - b.order);

  const apply = useCallback(
    (clientX: number, clientY: number, isDragging: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.container().getBoundingClientRect();
      const xInContainer = clientX - rect.left;
      const yInContainer = clientY - rect.top;
      const nativeX = (xInContainer / rect.width) * stageNativeWidth;
      const nativeY = (yInContainer / rect.height) * stageNativeHeight;

      const sub = subdivisions.find((s) => s.id === activeSubdivisionId);
      if (!sub) return;
      const cellSize = floor.baseCellSize / sub.cellSizeRatio;
      const maxX = floor.width * sub.cellSizeRatio;
      const maxY = floor.height * sub.cellSizeRatio;
      const gridX = Math.floor(nativeX / cellSize);
      const gridY = Math.floor(nativeY / cellSize);
      if (gridX < 0 || gridY < 0 || gridX >= maxX || gridY >= maxY) return;

      const textureId = tool === "paint" ? activeTextureId : null;
      if (tool === "paint" && !textureId) return;
      onPaint(
        floor.id,
        activeSubdivisionId,
        gridX,
        gridY,
        textureId,
        { x: clientX, y: clientY },
        isDragging,
      );
    },
    [activeTextureId, activeSubdivisionId, floor, onPaint, subdivisions, tool],
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
            baseCellSize: floor.baseCellSize,
            width: floor.width,
            height: floor.height,
          }}
        />
        {sortedSubs.map((sub) => {
          const cellSize = floor.baseCellSize / sub.cellSizeRatio;
          const subWidth = floor.width * sub.cellSizeRatio;
          const subHeight = floor.height * sub.cellSizeRatio;
          const cellsInSub = paintedCells.filter(
            (c) => c.floorId === floor.id && c.subdivisionId === sub.id,
          );
          return (
            <Layer key={sub.id} listening={false}>
              {cellsInSub.map((cell) => {
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
                  />
                );
              })}
              <Rect
                x={0}
                y={0}
                width={subWidth * cellSize}
                height={subHeight * cellSize}
                stroke={sub.id === activeSubdivisionId ? "#c9a86a" : "transparent"}
                strokeWidth={1}
                dash={[4, 4]}
              />
            </Layer>
          );
        })}
        {/* Doors layer — pure render, hit-tested via Stage.handlePaint. */}
        <DoorLayer
          doors={doors.filter((d) => d.floorId === floor.id)}
          cellSize={floor.baseCellSize}
          baseTextures={textures}
        />
      </Stage>
    </div>
  );
}

export const PaintCanvas = memo(PaintCanvasImpl);
