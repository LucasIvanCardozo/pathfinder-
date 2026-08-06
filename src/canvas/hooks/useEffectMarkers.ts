import { useMemo } from 'react';
import type { PaintedCell, ScenarioEffect, SubdivisionConfig } from '@/lib/shared/types';
import { isEffectBlockedByWall } from '../effects/blocked';
import { computeEffectFootprint } from '../effects/footprint';
import { templateById } from '../effects/spell-templates';
import { clipFootprintByWalls } from '../tools/clipFootprint';

/**
 * Per-cell visibility marker derived from a `ScenarioEffect` row. The
 * renderer iterates the array and emits one `<Rect>` per entry. The
 * `template` is resolved from the row's `templateId` so the renderer
 * doesn't need to look it up again.
 */
export type EffectMarkerCell = {
  effect: ScenarioEffect;
  /** Cell coordinate in the active subdivision's grid space. */
  gridX: number;
  gridY: number;
  /** The resolved template (shape, color, size). */
  template: ReturnType<typeof templateById>;
};

/**
 * Joined effect + resolved template + visible cells. The renderer collapses
 * the array into one `<Rect>` per cell with the colour from `template.color`.
 */
export type EffectMarker = {
  effect: ScenarioEffect;
  visibleCells: EffectMarkerCell[];
  template: ReturnType<typeof templateById>;
  /** Anchor cell in the active subdivision's grid space. Set for every effect. */
  anchor: { gridX: number; gridY: number };
  /** True when the wall-aware BFS produced an empty footprint. */
  blockedByWall: boolean;
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
   * and other call sites mirror it) for API stability; the hook no longer
   * needs it to compute the anchor (the anchor is already a cell coord on
   * the persisted row).
   */
  baseCellSize: number;
};

/**
 * Derive the per-cell geometry for every effect on the given floor.
 * Memoised so the `FloorCanvas` memo comparator sees a stable reference
 * between unrelated renders.
 *
 * Wall-aware BFS (the same `clipFootprintByWalls` that drives the darkness
 * erase, the brush preview, and the paint/erase strokes) drops cells behind a
 * structure wall; the anchor cell itself is
 * always visible per the design invariant. When the BFS empties the
 * footprint, the renderer falls back to the "blocked by wall" vignette.
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
 *                           cells).
 */
export function useEffectMarkers({
  floorId,
  effects,
  paintedCells,
  subdivisions,
  // `baseCellSize` is accepted for API stability with FloorCanvas but is no
  // longer needed in the body (the anchor is already a cell coord).
  baseCellSize: _baseCellSize,
}: UseEffectMarkersArgs): EffectMarker[] {
  return useMemo(() => {
    const activeSub =
      subdivisions.find((s) => s.id !== 'obscured' && s.id !== 'estructuras') ?? subdivisions[0];
    if (!activeSub) return [];

    // Filter to effects placed on THIS floor. Without this filter every
    // FloorCanvas renders every effect in the scenario, so a fireball on
    // Planta Baja appears identically on every floor above and below it.
    const floorEffects = effects.filter((e) => e.floorId === floorId);

    // Pre-compute the wall set once per call. Lookups inside the per-cell
    // BFS use string keys so the closure stays side-effect free.
    const wallKeys = new Set<string>();
    for (const c of paintedCells) {
      if (c.subdivisionId === 'estructuras') {
        wallKeys.add(`${c.gridX}|${c.gridY}`);
      }
    }
    const isWall = (x: number, y: number) => wallKeys.has(`${x}|${y}`);

    return floorEffects.map<EffectMarker>((effect) => {
      const template = templateById(effect.templateId);
      // Anchor is already a cell coord (the editor pre-fills with the
      // `gridX` / `gridY` of the cell the GM clicked). `Math.round` is a
      // defensive net for legacy rows whose Prisma column is `Float` but
      // was authored as a whole number.
      const anchor = {
        gridX: Math.round(effect.originCellX),
        gridY: Math.round(effect.originCellY),
      };
      const footprint = computeEffectFootprint(effect, activeSub.cellSizeRatio);
      const visibleCells = clipFootprintByWalls(anchor, footprint, isWall).map<EffectMarkerCell>(
        (c) => ({ effect, gridX: c.gridX, gridY: c.gridY, template }),
      );
      return {
        effect,
        visibleCells,
        template,
        anchor,
        // Same wall-aware BFS as the renderer, routed through the shared
        // helper so the `EffectTooltip` blocked-by-wall hint and the
        // vignette marker can never diverge from the renderer's verdict.
        blockedByWall: isEffectBlockedByWall(effect, paintedCells, subdivisions),
      };
    });
  }, [effects, paintedCells, subdivisions, floorId]);
}
