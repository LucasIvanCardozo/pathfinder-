import type { PaintedCell, Piece } from '@/lib/shared/types';
import { getTrait } from '../../traits';

/**
 * Resolve the imagePath to render for a cell. Pieces with stateful traits
 * (e.g. doors) may override the visual state per cell. Falls back to the
 * piece's default visual state, then to the caller-supplied fallback path.
 */
export function resolveRenderImagePath(
  cell: PaintedCell,
  fallbackPath: string,
  pieceById: Map<string, Piece>,
): string {
  const piece = pieceById.get(cell.pieceId);
  if (!piece) return fallbackPath;
  const trait = getTrait('door-states');
  if (!trait?.resolveTextureId) {
    const def = piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0];
    return def?.imagePath ?? fallbackPath;
  }
  return trait.resolveTextureId(cell, fallbackPath, piece);
}
