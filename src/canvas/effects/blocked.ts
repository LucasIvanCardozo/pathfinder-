import type { PaintedCell, ScenarioEffect, SubdivisionConfig } from '@/lib/shared/types';
import { eraseFootprintFor } from '../tools/eraseFootprint';
import { computeEffectFootprint } from './footprint';

/**
 * Per-effect wall-blocked check. Returns `true` when the wall-aware BFS
 * produces an empty footprint — the marker exists in state but no cell of
 * its visible geometry is reachable from the anchor without crossing a
 * structure wall.
 *
 * The helper intentionally rebuilds the wall set + footprint + BFS rather
 * than threading the already-computed footprint through, so call sites can
 * decide "is this marker fully hidden?" without coupling to the per-cell
 * geometry used by the renderer.
 */
export function isEffectBlockedByWall(
  effect: ScenarioEffect,
  paintedCells: readonly PaintedCell[],
  subdivisions: readonly SubdivisionConfig[],
): boolean {
  const activeSub =
    subdivisions.find((s) => s.id !== 'obscured' && s.id !== 'estructuras') ?? subdivisions[0];
  if (!activeSub) return false;

  const wallKeys = new Set<string>();
  for (const c of paintedCells) {
    if (c.subdivisionId === 'estructuras') {
      wallKeys.add(`${c.gridX}|${c.gridY}`);
    }
  }
  const isWall = (x: number, y: number) => wallKeys.has(`${x}|${y}`);
  const anchor = {
    gridX: Math.round(effect.originCellX),
    gridY: Math.round(effect.originCellY),
  };
  const footprint = computeEffectFootprint(effect, activeSub.cellSizeRatio);
  const visible = eraseFootprintFor(anchor, footprint, isWall);
  return visible.length === 0;
}
