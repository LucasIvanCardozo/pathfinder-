"use client";

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Map dimensions shared by every floor in the scenario. */
  mapDims: { baseCellSize: number; width: number; height: number };
  /** Display zoom multiplier. 1 = 100% (world pixels). The Stage applies
   *  it as a transform (scaleX/Y); all rendering stays in world coords. */
  zoom: number;
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


function PaintCanvasImpl({
  floors,
  activeFloorId,
  mapDims,
  zoom,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0]!;

  // Track the viewport size via ResizeObserver. The Stage uses these as its
  // intrinsic dimensions, keeping the canvas at a constant small size
  // (whatever fits in the editor) regardless of zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Centre the world on first valid viewport size. Subsequent floor or
  // zoom changes are handled by the next effect; this one only fires on
  // mount (via the `initialCenteredRef` guard).
  const initialCenteredRef = useRef(false);
  useEffect(() => {
    if (initialCenteredRef.current) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    const worldWidth = mapDims.width * mapDims.baseCellSize;
    const worldHeight = mapDims.height * mapDims.baseCellSize;
    setPan({
      x: viewportSize.width / 2 - (worldWidth * zoom) / 2,
      y: viewportSize.height / 2 - (worldHeight * zoom) / 2,
    });
    initialCenteredRef.current = true;
  }, [viewportSize, zoom, mapDims]);

  // Preserve the visual centre on zoom changes. Math: the world point at
  // the viewport centre before the change is `(viewportCenter - pan) / oldZoom`;
  // multiply by the new zoom and subtract the viewport half-size to position
  // the same world point back at the centre.
  //
  // We read the latest `pan` from a ref (not the effect dep) so the
  // effect doesn't refire on every pan change, only on zoom.
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  const prevZoomRef = useRef(zoom);
  useEffect(() => {
    if (!initialCenteredRef.current) return;
    if (viewportSize.width === 0) return;
    const prevZoom = prevZoomRef.current;
    if (prevZoom === zoom) return;
    const currentPan = panRef.current;
    const worldCx = (viewportSize.width / 2 - currentPan.x) / prevZoom;
    const worldCy = (viewportSize.height / 2 - currentPan.y) / prevZoom;
    setPan({
      x: viewportSize.width / 2 - worldCx * zoom,
      y: viewportSize.height / 2 - worldCy * zoom,
    });
    prevZoomRef.current = zoom;
  }, [zoom, viewportSize.width, viewportSize.height]);

  // Visible world rect (world coords) for grid-line culling and bounds
  // checks. The Stage applies the zoom as a transform, so dividing
  // viewport size by zoom gives world units.
  const worldBounds = useMemo(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return null;
    return {
      x: -pan.x / zoom,
      y: -pan.y / zoom,
      width: viewportSize.width / zoom,
      height: viewportSize.height / zoom,
    };
  }, [
    pan.x,
    pan.y,
    zoom,
    viewportSize.width,
    viewportSize.height,
  ]);

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

  // Paint stroke handler. Pointer coords are in WORLD coords (Konva's
  // `getRelativePointerPosition` accounts for the stage transform).
  const apply = useCallback(
    (pointer: { x: number; y: number }, isDragging: boolean) => {
      const sub = subById.get(activeSubdivisionId);
      if (!sub) return;
      // World-coord cell size (no zoom multiplier; stage scales the render).
      const cellSize = mapDims.baseCellSize / sub.cellSizeRatio;
      const maxX = mapDims.width * sub.cellSizeRatio;
      const maxY = mapDims.height * sub.cellSizeRatio;
      const gridX = Math.floor(pointer.x / cellSize);
      const gridY = Math.floor(pointer.y / cellSize);
      if (gridX < 0 || gridY < 0 || gridX >= maxX || gridY >= maxY) return;

      const pieceId = tool === "paint" ? activePieceId : null;
      if (tool === "paint" && !pieceId) return;
      onPaint(
        activeFloor.id,
        activeSubdivisionId,
        gridX,
        gridY,
        pieceId,
        null,
        isDragging,
      );
    },
    [
      activePieceId,
      activeSubdivisionId,
      activeFloor.id,
      mapDims.baseCellSize,
      mapDims.width,
      mapDims.height,
      onPaint,
      subById,
      tool,
    ],
  );

  // Track the space key to enable space+drag panning. preventDefault
  // stops the browser from scrolling the page when space is held.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Window-level mouse listeners for panning (so drag works even when the
  // cursor leaves the stage area).
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const drag = dragStartRef.current;
      setPan({
        x: drag.panX + (e.clientX - drag.mouseX),
        y: drag.panY + (e.clientY - drag.mouseY),
      });
    };
    const handleUp = () => {
      dragStartRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  // Touch handling: single-finger drag pans, two-finger gesture reserved
  // for future zoom (not implemented yet). For now, touch panning lets the
  // user navigate on mobile without conflicting with paint (paint on
  // mobile would need a separate UX, deferred).
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const drag = dragStartRef.current;
      setPan({
        x: drag.panX + (t.clientX - drag.mouseX),
        y: drag.panY + (t.clientY - drag.mouseY),
      });
    };
    const handleTouchEnd = () => {
      dragStartRef.current = null;
    };
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const getPointer = (): { x: number; y: number } | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.getRelativePointerPosition();
  };

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Right-click is reserved for opening trait menus (see handleContextMenu);
    // it must not start a paint stroke or pan.
    if (e.evt.button === 2) return;
    // Left-click + space: pan.
    if (e.evt.button === 0 && isSpaceDown) {
      e.evt.preventDefault();
      dragStartRef.current = {
        mouseX: e.evt.clientX,
        mouseY: e.evt.clientY,
        panX: pan.x,
        panY: pan.y,
      };
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
    // Panning is handled by the window-level listener above so the cursor
    // can leave the stage area without losing the drag.
    if (dragStartRef.current) return;
    if (!isDrawingRef.current) return;
    const pointer = getPointer();
    if (!pointer) return;
    apply(pointer, true);
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    // Single-finger touch pans (consistent with desktop middle-click).
    const t = e.evt.touches[0];
    if (!t) return;
    e.evt.preventDefault();
    dragStartRef.current = {
      mouseX: t.clientX,
      mouseY: t.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleTouchEnd = () => {
    dragStartRef.current = null;
  };

  /**
   * Right-click handler. Finds the topmost painted cell under the cursor
   * in world coords (so it works across subdivisions with different
   * cellSizeRatio) and, if that piece has an interactive trait (e.g.
   * door-states), opens its trait menu. Suppresses the browser's native
   * context menu.
   */
  const handleContextMenu = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    if (!onOpenTraitMenu) return;
    const pointer = getPointer();
    if (!pointer) return;
    const found = findInteractiveCellAtPixel({
      cells: paintedCells,
      floorId: activeFloor.id,
      pixelX: pointer.x,
      pixelY: pointer.y,
      baseCellSize: mapDims.baseCellSize,
      subById,
      pieceById,
    });
    if (!found) return;
    onOpenTraitMenu(found.cell.id, found.trait.kind, { x: e.evt.clientX, y: e.evt.clientY });
  };

  // Render-time cellSize helpers (world coords).
  const cellSizeFor = (sub: SubdivisionConfig) =>
    mapDims.baseCellSize / sub.cellSizeRatio;

  // Cursor reflects the current interaction: default crosshair (paint), grab
  // when space is held, grabbing while a pan drag is in progress.
  const baseCursor = tool === "erase" ? "cell" : "crosshair";
  const cursor = isSpaceDown
    ? dragStartRef.current
      ? "grabbing"
      : "grab"
    : baseCursor;

  return (
    <div ref={containerRef} className={styles.canvas} style={{ cursor }}>
      <Stage
        ref={stageRef}
        width={Math.max(1, viewportSize.width)}
        height={Math.max(1, viewportSize.height)}
        scaleX={zoom}
        scaleY={zoom}
        x={pan.x}
        y={pan.y}
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
          {itemsByZ.map((item) => {
            const cellSize = cellSizeFor(item.sub);
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

        <GridLayer
          config={{
            worldBaseCellSize: mapDims.baseCellSize,
            width: mapDims.width,
            height: mapDims.height,
            worldBounds: worldBounds ?? undefined,
          }}
        />
      </Stage>
      {overlay}
    </div>
  );
}
export const PaintCanvas = memo(PaintCanvasImpl);