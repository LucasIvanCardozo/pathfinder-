"use client";

import { useMemo } from "react";
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from "@/lib/shared/types";
import { useStageViewport } from "@/hooks/useStageViewport";
import { useTextureImages } from "../useTextureImages";
import { FloorCanvas } from "./FloorCanvas";
import { WorldGrid } from "./WorldGrid";
import styles from "./FloorStack.module.css";

type MapDims = { baseCellSize: number; width: number; height: number };

type Props = {
  floors: Floor[];
  activeFloorId: string;
  mapDims: MapDims;
  /** Controlled by the parent (typically the editor header's zoom buttons). */
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
  onOpenTraitMenu?: (
    cellId: string,
    traitKind: string,
    screenPos: { x: number; y: number },
  ) => void;
  /** Optional overlay (e.g. WeatherOverlay) rendered above the WorldGrid. */
  overlay?: React.ReactNode;
};

/**
 * Stack of per-floor `FloorCanvas` instances plus the shared `WorldGrid`
 * and the optional overlay. Owns the viewport hook (pan/zoom/space-key/
 * window pan listeners) so every floor in the stack shares one viewport.
 */
function FloorStackImpl({
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
  const {
    containerRef,
    viewportSize,
    pan,
    beginPan,
    isSpaceDown,
    isPanning,
    worldBounds,
  } = useStageViewport({ mapDims, zoom });

  const cellsForFloor = useMemo(() => {
    const m = new Map<string, PaintedCell[]>();
    for (const cell of paintedCells) {
      const bucket = m.get(cell.floorId);
      if (bucket) {
        bucket.push(cell);
      } else {
        m.set(cell.floorId, [cell]);
      }
    }
    return m;
  }, [paintedCells]);

  // Resolve the active index defensively — if the id isn't found (degenerate
  // empty scenario), fall back to the first floor so the canvas still
  // initialises something visible.
  const activeIndex = Math.max(0, floors.findIndex((f) => f.id === activeFloorId));

  // Only floors at or below the active one render. Floors above are not
  // drawn (matches the prior PaintCanvas behaviour: no painted cells shown).
  const visibleFloors = useMemo(() => floors.slice(0, activeIndex + 1), [
    floors,
    activeIndex,
  ]);

  // Load every piece's texture image once and share the map with all
  // FloorCanvas instances — the browser deduplicates the network requests
  // and we avoid N independent `useTextureImages` calls with the same paths.
  const allImagePaths = useMemo(() => {
    const set = new Set<string>();
    for (const p of pieces) {
      for (const v of p.visualStates) set.add(v.imagePath);
    }
    return Array.from(set);
  }, [pieces]);

  const textureImages = useTextureImages(allImagePaths);

  return (
    <div ref={containerRef} className={styles.stack}>
      {visibleFloors.map((floor, idx) => {
        const isActive = idx === activeIndex;
        const cells = cellsForFloor.get(floor.id) ?? [];
        return (
          <FloorCanvas
            key={floor.id}
            floor={floor}
            cells={cells}
            depthFromActive={Math.max(0, activeIndex - idx)}
            isActive={isActive}
            mapDims={mapDims}
            subdivisions={subdivisions}
            pieces={pieces}
            textureImages={textureImages}
            activeSubdivisionId={activeSubdivisionId}
            activePieceId={activePieceId}
            tool={tool}
            viewportSize={viewportSize}
            pan={pan}
            zoom={zoom}
            beginPan={beginPan}
            isSpaceDown={isSpaceDown}
            isPanning={isPanning}
            onPaint={onPaint}
            onOpenTraitMenu={onOpenTraitMenu}
          />
        );
      })}
      <div className={styles.worldGridOverlay}>
        <WorldGrid
          mapDims={mapDims}
          viewportSize={viewportSize}
          pan={pan}
          zoom={zoom}
          worldBounds={worldBounds}
        />
      </div>
      {overlay}
    </div>
  );
}

export const FloorStack = FloorStackImpl;
