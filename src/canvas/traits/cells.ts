import type { PaintedCell, Piece, SubdivisionConfig } from "@/pieces";
import { getTrait, type TraitImpl } from "./registry";

/**
 * Locates the topmost painted cell under a pixel position on the canvas, and
 * returns the first interactive trait on that piece's trait list.
 *
 * Why we work in pixel coords rather than `(gridX, gridY)`:
 * Each subdivision has its own `cellSizeRatio`, so the same `(gridX, gridY)`
 * pair maps to two completely different physical locations depending on
 * which subdivision owns the cell. Iterating in pixel space lets us respect
 * each cell's own subdivision rule, regardless of which subdivision is
 * currently active in the UI.
 *
 * The "topmost" criterion means the highest-`order` subdivision wins when
 * two cells overlap at the same pixel — which mirrors what the user sees
 * (the door rendered on top of the floor).
 */
export function findInteractiveCellAtPixel(args: {
  cells: readonly PaintedCell[];
  floorId: string;
  pixelX: number;
  pixelY: number;
  baseCellSize: number;
  subById: Map<string, SubdivisionConfig>;
  pieceById: Map<string, Piece>;
}): { cell: PaintedCell; piece: Piece; trait: TraitImpl } | null {
  const { cells, floorId, pixelX, pixelY, baseCellSize, subById, pieceById } = args;

  let bestZ = -1;
  let best: { cell: PaintedCell; sub: SubdivisionConfig; piece: Piece } | null = null;

  for (const cell of cells) {
    if (cell.floorId !== floorId) continue;
    const sub = subById.get(cell.subdivisionId);
    if (!sub) continue;
    const cellSize = baseCellSize / sub.cellSizeRatio;
    const minX = cell.gridX * cellSize;
    const minY = cell.gridY * cellSize;
    if (pixelX < minX || pixelX >= minX + cellSize) continue;
    if (pixelY < minY || pixelY >= minY + cellSize) continue;
    const piece = pieceById.get(cell.pieceId);
    if (!piece) continue;
    if (sub.order > bestZ) {
      bestZ = sub.order;
      best = { cell, sub, piece };
    }
  }

  if (!best) return null;

  // Find the first interactive trait on the topmost piece.
  for (const t of best.piece.traits ?? []) {
    const impl = getTrait(t.kind);
    if (impl?.getMenu) {
      return { cell: best.cell, piece: best.piece, trait: impl };
    }
  }
  return null;
}
