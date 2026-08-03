import { useMemo } from 'react';
import type { PaintedCell, ScenarioEffect, SubdivisionConfig } from '@/lib/shared/types';

/**
 * Per-cell visibility marker derived from a `ScenarioEffect` row. The
 * renderer iterates the array and emits one `<Rect>` per entry. The
 * `renderKind` discriminator lets the renderer dispatch on effect shape
 * (e.g. dashed stroke for `wall`) without re-deriving the field.
 */
export type EffectMarkerCell = {
  effect: ScenarioEffect;
  /** Cell coordinate in the active subdivision's grid space. */
  gridX: number;
  gridY: number;
  /** Mirrors `effect.kind` for the renderer's switch. */
  renderKind: ScenarioEffect['kind'];
};

export type UseEffectMarkersArgs = {
  floorId: string;
  effects: readonly ScenarioEffect[];
  paintedCells: readonly PaintedCell[];
  subdivisions: readonly SubdivisionConfig[];
  /** Scenario-level metres-per-cell; combined with `cellSizeRatio` to compute
   *  the world cell size. */
  baseCellSize: number;
};

export type EffectMarkerResult = {
  effect: ScenarioEffect;
  visibleCells: EffectMarkerCell[];
  renderKind: ScenarioEffect['kind'];
};

/**
 * Convert one `ScenarioEffect` into the per-cell geometry the renderer
 * needs. PR 1 ships the **rectangular footprint** unconditionally — the
 * wall-aware BFS that gates cells behind structure walls lands in PR 2
 * (T2.14, design §12.2). The anchor cell itself always counts as visible
 * (design §13.2); off-floor or negative-width/depth effects degrade to
 * an empty array.
 */
function computeEffectFootprint(
  effect: ScenarioEffect,
  activeCellSize: number,
): EffectMarkerCell[] {
  if (activeCellSize <= 0) return [];
  if (effect.widthM <= 0 || effect.depthM <= 0) return [];

  // Anchor in active-subdivision cell space (round to the nearest cell so
  // the visible footprint aligns with the rendered grid).
  const anchorX = Math.round(effect.originX / activeCellSize);
  const anchorY = Math.round(effect.originY / activeCellSize);

  // Rectangular bounding box of `widthM x depthM` metres, centred on the
  // anchor (matches the PR 2 `burstFootprint` shape per design §13.2).
  const halfWidthCells = Math.max(0, Math.floor(effect.widthM / activeCellSize / 2));
  const halfDepthCells = Math.max(0, Math.floor(effect.depthM / activeCellSize / 2));

  const cells: EffectMarkerCell[] = [];
  for (let dx = -halfWidthCells; dx <= halfWidthCells; dx++) {
    for (let dy = -halfDepthCells; dy <= halfDepthCells; dy++) {
      cells.push({
        effect,
        gridX: anchorX + dx,
        gridY: anchorY + dy,
        renderKind: effect.kind,
      });
    }
  }
  return cells;
}

/**
 * Derive the per-cell geometry for every effect on the given floor.
 * Memoised so the `FloorCanvas` memo comparator sees a stable reference
 * between unrelated renders.
 *
 * @param args.floorId   Restricts the markers to effects placed on this
 *                       floor. Switching floors swaps the overlay atomically.
 * @param args.effects   All effects for the scenario; the hook filters by
 *                       `floorId`.
 * @param args.paintedCells  Currently unused by the PR 1 stub; kept in the
 *                           signature because PR 2's wall-aware BFS reads
 *                           structure cells from this list and the marker
 *                           geometry must re-derive when they change.
 * @param args.subdivisions  Used to derive the active subdivision's
 *                           `cellSize` (= `baseCellSize / cellSizeRatio`).
 *                           PR 1 picks the first non-`obscured` subdivision;
 *                           PR 2 reads the active one from `EditorClient`.
 * @param args.baseCellSize  Scenario-level metres-per-cell; combined with
 *                           `cellSizeRatio` to compute the world cell size.
 */
export function useEffectMarkers({
  floorId,
  effects,
  paintedCells: _paintedCells,
  subdivisions,
  baseCellSize,
}: UseEffectMarkersArgs): EffectMarkerResult[] {
  return useMemo(() => {
    const activeSub =
      subdivisions.find((s) => s.id !== 'obscured' && s.id !== 'estructuras') ?? subdivisions[0];
    if (!activeSub) return [];
    const cellSize = baseCellSize / activeSub.cellSizeRatio;

    return effects
      .filter((e) => e.floorId === floorId)
      .map<EffectMarkerResult>((effect) => ({
        effect,
        visibleCells: computeEffectFootprint(effect, cellSize),
        renderKind: effect.kind,
      }));
  }, [effects, floorId, subdivisions, baseCellSize]);
}
