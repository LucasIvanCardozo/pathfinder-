import { useMemo } from 'react';
import type { PaintedCell, ScenarioEffect, SubdivisionConfig } from '@/lib/shared/types';
import { eraseFootprintFor } from '../tools/eraseFootprint';
import { computeEffectFootprint } from '../effects/footprint';

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
  /**
   * Painted cells for the active floor. The wall-aware BFS uses the
   * `subdivisionId === 'estructuras'` subset as opaque propagation walls —
   * the same set used for darkness erasure (no new state).
   */
  paintedCells: readonly PaintedCell[];
  subdivisions: readonly SubdivisionConfig[];
  /**
   * Scenario-level metres-per-cell. Kept on the args (FloorCanvas passes it
   * and other call sites mirror it) for API stability; after the
   * `originX`/`originY` → `originCellX`/`originCellY` rename the hook no
   * longer needs it to compute the anchor. Footprint dimensions convert
   * via the active subdivision's `cellSizeRatio`.
   */
  baseCellSize: number;
  /**
   * Effects the GM has "switched off" client-side (Bug 3a). The row stays
   * in the DB and in `effects`, but the marker is hidden and its footprint
   * no longer participates in coverage. PR 2 wires the dismiss action;
   * the set is owned by EditorClient and threaded through FloorStack.
   */
  dismissedEffects: ReadonlySet<string>;
};

/**
 * Joined effect + visible cells. The renderer collapses the array into one
 * `<Rect>` per cell with the alpha from `resultingAlpha(effect.alphasAt(x,y))`.
 *
 * `anchor` is set for every effect and lets the renderer draw the
 * "blocked by wall" vignette when the wall-aware BFS emptied the footprint.
 * `blockedByWall: true` means the renderer should fall back to the vignette
 * at the anchor and skip the per-cell `<Rect>` loop.
 */
export type EffectMarkerResult = {
  effect: ScenarioEffect;
  visibleCells: EffectMarkerCell[];
  renderKind: ScenarioEffect['kind'];
  /** Anchor cell in the active subdivision's grid space. Set for every effect. */
  anchor: { gridX: number; gridY: number };
  /** True when the wall-aware BFS produced an empty footprint. */
  blockedByWall: boolean;
};

/**
 * Derive the per-cell geometry for every effect on the given floor.
 * Memoised so the `FloorCanvas` memo comparator sees a stable reference
 * between unrelated renders.
 *
 * The wall-aware BFS (PR 2, design §12.2) replaces PR 1's unconditional
 * rectangular stub: each effect's footprint is filtered through
 * `eraseFootprintFor` with `isWall` built from the `estructuras` cells, so a
 * structure wall between the anchor and a target cell drops the target.
 * The anchor cell itself is always reachable (matches the
 * `eraseFootprintFor` `centerIsWall` semantics and the design invariant).
 *
 * When the wall-aware BFS returns an empty array AND the anchor cell exists,
 * the renderer falls back to the "blocked by wall" vignette (T2.14 bonus).
 *
 * @param args.floorId   Restricts the markers to effects placed on this
 *                       floor. Switching floors swaps the overlay atomically.
 * @param args.effects   All effects for the scenario; the hook filters by
 *                       `floorId`.
 * @param args.paintedCells  Subset of painted cells for the active floor.
 *                           The `estructuras` ones become propagation walls.
 * @param args.subdivisions  Used to derive the active subdivision's
 *                           `cellSizeRatio` (passed through to the footprint
 *                           walker so it can convert feet → active-subdivision
 *                           cells). `baseCellSize` is no longer needed here
 *                           because the anchor is already a cell coord.
 */
export function useEffectMarkers({
  floorId,
  effects,
  paintedCells,
  subdivisions,
  // `baseCellSize` is accepted for API stability with FloorCanvas but is no
  // longer needed in the body (the anchor is already a cell coord).
  baseCellSize: _baseCellSize,
  dismissedEffects,
}: UseEffectMarkersArgs): EffectMarkerResult[] {
  return useMemo(() => {
    const activeSub =
      subdivisions.find((s) => s.id !== 'obscured' && s.id !== 'estructuras') ?? subdivisions[0];
    if (!activeSub) return [];

    // Pre-compute the wall set once per call. Lookups inside the per-cell
    // BFS use string keys so the closure stays side-effect free.
    const wallKeys = new Set<string>();
    for (const c of paintedCells) {
      if (c.subdivisionId === 'estructuras') {
        wallKeys.add(`${c.gridX}|${c.gridY}`);
      }
    }
    const isWall = (x: number, y: number) => wallKeys.has(`${x}|${y}`);

    return effects
      .filter((e) => e.floorId === floorId && !dismissedEffects.has(e.id))
      .map<EffectMarkerResult>((effect) => {
        // Anchor is already a cell coord (the modal pre-fills with the
        // `gridX` / `gridY` of the cell the GM clicked). `Math.round` is a
        // defensive net for legacy rows whose Prisma column is `Float` but
        // was authored as a whole number.
        const anchor = {
          gridX: Math.round(effect.originCellX),
          gridY: Math.round(effect.originCellY),
        };
        const footprint = computeEffectFootprint(effect, activeSub.cellSizeRatio);
        const visibleCells = eraseFootprintFor(anchor, footprint, isWall).map<EffectMarkerCell>(
          (c) => ({ effect, gridX: c.gridX, gridY: c.gridY, renderKind: effect.kind }),
        );
        return {
          effect,
          visibleCells,
          renderKind: effect.kind,
          anchor,
          blockedByWall: visibleCells.length === 0,
        };
      });
  }, [effects, floorId, paintedCells, subdivisions, dismissedEffects]);
}
