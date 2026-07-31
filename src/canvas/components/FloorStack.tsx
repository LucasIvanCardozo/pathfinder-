'use client';

import { memo,  useMemo } from 'react';
import { useStageViewport } from '@/hooks/useStageViewport';
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from '@/lib/shared/types';
import { useFloorCellsByFloor } from '../hooks/useFloorCellsByFloor';
import { useVisibleFloors } from '../hooks/useVisibleFloors';
import type { BrushCell, BrushShape, BrushSize, ToolKind } from '../tools';
import { useTextureImages } from '../useTextureImages';
import { FloorCanvas } from './FloorCanvas';
import styles from './floor-stack.module.css';
import { WorldGrid } from './WorldGrid';

type MapDims = { baseCellSize: number; width: number; height: number };

type Props = {
  floors: Floor[];
  activeFloorId: string;
  mapDims: MapDims;
  /** Controlled by the parent (typically the editor header's zoom buttons). */
  zoom: number;
  subdivisions: readonly SubdivisionConfig[];
  paintedCells: PaintedCell[];
  pieces: Piece[];
  activeSubdivisionId: string;
  activePieceId: string | null;
  tool: ToolKind;
  brushSize: BrushSize;
  /** Geometric shape of the brush footprint (circle vs. square). Propagated
   *  to each FloorCanvas so the painter and the hover preview agree on
   *  the same footprint. */
  brushShape: BrushShape;
  /** When false, FloorCanvas skips rendering the brush footprint preview.
   *  Toggled by the `toggleBrushPreview` shortcut in the editor. */
  showBrushPreview?: boolean;
  onPaint: (
    floorId: string,
    subdivisionId: string,
    cells: BrushCell[],
    pieceId: string | null,
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
  brushSize,
  brushShape,
  showBrushPreview = true,
  onPaint,
  onOpenTraitMenu,
  overlay,
}: Props) {
  const { containerRef, viewportSize, pan, beginPan, isPanDown, isPanning, worldBounds } =
    useStageViewport({ mapDims, zoom });

  const cellsForFloor = useFloorCellsByFloor(paintedCells);
  const { activeIndex, visibleFloors } = useVisibleFloors(floors, activeFloorId);

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
          <FloorCanvas key={floor.id}
              floor={floor}
              cells={cells}
              depthFromActive={activeIndex - idx}
              isActive={isActive}
              mapDims={mapDims}
              subdivisions={subdivisions}
              pieces={pieces}
              textureImages={textureImages}
              activeSubdivisionId={activeSubdivisionId}
              activePieceId={activePieceId}
              tool={tool}
              brushSize={brushSize}
              brushShape={brushShape}
              showBrushPreview={showBrushPreview}
              viewportSize={viewportSize}
              pan={pan}
              zoom={zoom}
              beginPan={beginPan}
              isPanDown={isPanDown}
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



/**
 * React.memo: FloorStack re-renders only when its props change. Without
 * this, every stroke in the editor would re-render FloorStack and the
 * `useMemo` buckets it computes (`cellsForFloor`, `visibleFloors`, ...)
 * — and on every render the buckets are fresh arrays (not the same
 * references) so `FloorCanvas`'s content-equality comparator would still
 * pass for the inactive floors. But we'd waste work on the re-render
 * itself. With memo, the only thing that invalidates FloorStack is a
 * prop change.
 */
export const FloorStack = memo(FloorStackImpl);
