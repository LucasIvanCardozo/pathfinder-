import type { ScenarioEffect } from '@/lib/shared/types';
import { FEET_PER_BASE_CELL } from '@/lib/shared/constants';
import type { BrushCell } from '../tools/types';
import { templateById } from './spell-templates';

// =============================================================================
// Spell footprint geometry (PR 1 of the spellcasting refactor).
//
// Coordinates:
//   - `effect.originCellX` / `effect.originCellY` are integer cell coords in the
//     active subdivision's grid space.
//   - The shape and dimensions are resolved from `SPELL_TEMPLATES` keyed by
//     `effect.templateId` — the renderer and the picker UI share this single
//     source of truth (see `spell-templates.ts`).
//   - `effect.rotationDeg` is in discrete steps of 0/90/180/270. Circles ignore
//     it (radii are rotation-invariant).
//
// Units:
//   - Template `sizeFt` is forward length for cones, radius for circles.
//   - `cellSizeRatio` is the active subdivision's `base cells per
//     active-subdivision cell` (1 for suelo/estructuras/obscured, 2 for
//     objetos-grandes, 4 for objetos-pequenos). One base cell = 5 ft.
// =============================================================================

/**
 * Direction unit vector for a discrete rotation (0/90/180/270). Cones walk
 * along this vector for the shape's forward length; the width fan-out is
 * perpendicular to it. 0° = north (-Y in screen coords).
 */
function directionFor(rotationDeg: number): { dx: number; dy: number } {
  // Snap to the nearest cardinal direction so 1° or 89° collapses to the
  // closest of 0/90/180/270.
  const snapped = Math.round(rotationDeg / 90) * 90;
  const rad = (snapped * Math.PI) / 180;
  // Y axis is flipped (screen coords) so we negate sin to keep clockwise
  // rotation visually correct.
  return { dx: Math.sin(rad), dy: -Math.cos(rad) };
}

/** Perpendicular unit vector (90° clockwise from the direction). */
function perpRight(d: { dx: number; dy: number }): { dx: number; dy: number } {
  return { dx: d.dy, dy: -d.dx };
}

/**
 * Cone / directional fan from the anchor. Bresenham-walk `lengthFt` cells
 * along the direction, and for each step expand the perpendicular footprint
 * by `lengthFt / 2` cells on each side (the width grows linearly from 0 at
 * the anchor to `lengthFt` at the tip and stays there — same proportions as
 * the original 5e cone template).
 */
function coneFootprint(
  anchorX: number,
  anchorY: number,
  lengthFt: number,
  rotationDeg: number,
  cellSizeRatio: number,
): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  if (lengthFt <= 0) return [];
  const lengthCells = Math.max(
    1,
    Math.floor((lengthFt * cellSizeRatio) / FEET_PER_BASE_CELL),
  );
  const dir = directionFor(rotationDeg);
  const perp = perpRight(dir);
  const cells: BrushCell[] = [];
  const seen = new Set<string>();
  const add = (gx: number, gy: number) => {
    const key = `${gx}|${gy}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ gridX: gx, gridY: gy });
  };
  add(anchorX, anchorY);
  for (let step = 1; step <= lengthCells; step++) {
    const cx = anchorX + Math.round(dir.dx * step);
    const cy = anchorY + Math.round(dir.dy * step);
    // Width at this step: linear ramp from 0 (anchor) to `lengthFt` worth of
    // cells. We use `lengthFt` as the cone's width spec (D&D convention:
    // a 15-ft cone is 15 ft wide at the tip). Each "foot" maps to
    // `cellSizeRatio / FEET_PER_BASE_CELL` active-subdivision cells.
    const halfCells = Math.max(
      0,
      Math.floor(
        ((lengthFt * cellSizeRatio) / FEET_PER_BASE_CELL / 2) * (step / lengthCells),
      ),
    );
    for (let w = -halfCells; w <= halfCells; w++) {
      const gx = cx + Math.round(perp.dx * w);
      const gy = cy + Math.round(perp.dy * w);
      add(gx, gy);
    }
  }
  return cells;
}

/**
 * Circle / radius footprint. Emits every cell whose Euclidean distance from
 * the anchor is <= `radiusCells`. Includes the anchor cell.
 */
function circleFootprint(
  anchorX: number,
  anchorY: number,
  radiusFt: number,
  cellSizeRatio: number,
): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  if (radiusFt <= 0) return [];
  const radiusCells = Math.max(
    0,
    (radiusFt * cellSizeRatio) / FEET_PER_BASE_CELL,
  );
  const cells: BrushCell[] = [];
  const r = Math.ceil(radiusCells);
  // We square the threshold instead of sqrt'ing per cell to skip the
  // Math.sqrt call (small optimisation — the loop is hot).
  const r2 = radiusCells * radiusCells;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (dx * dx + dy * dy <= r2) {
        cells.push({ gridX: anchorX + dx, gridY: anchorY + dy });
      }
    }
  }
  return cells;
}

/**
 * Compute the per-cell footprint for one spell. Dispatches on the persisted
 * `templateId` to the shape-specific walker. The walker ignores
 * `rotationDeg` for circles; cones read it directly.
 *
 * `cellSizeRatio` is the active subdivision's `base cells per
 * active-subdivision cell` (e.g. 1 for `suelo`, 2 for `objetos-grandes`).
 *
 * The returned cells are an *over-estimate* — the wall-aware BFS in
 * `useEffectMarkers` post-filters them via `eraseFootprintFor` so cells
 * behind a structure wall are dropped. The walkers return the full geometry
 * so the BFS has the right starting shape.
 */
export function computeEffectFootprint(
  effect: ScenarioEffect,
  cellSizeRatio: number,
): BrushCell[] {
  const template = templateById(effect.templateId);
  const anchorX = Math.round(effect.originCellX);
  const anchorY = Math.round(effect.originCellY);
  return template.shape === 'cone'
    ? coneFootprint(anchorX, anchorY, template.sizeFt, effect.rotationDeg, cellSizeRatio)
    : circleFootprint(anchorX, anchorY, template.sizeFt, cellSizeRatio);
}

/**
 * Per-cell alpha-blend cap math. Each effect contributes its base alpha (0.35
 * in v1) and the composite is capped at 0.7. The formula is the standard
 * "over" blend: `1 - Π(1 - aᵢ)`.
 *
 * Returns a number in `[0, 0.7]`. The anchor cell with a single effect
 * contribution returns 0.35 (the base alpha); two overlapping effects
 * return `1 - (1 - 0.35)² = 0.5775`, capped at 0.7 the user can still see
 * the underlying grid through the composite.
 */
export function resultingAlpha(alphas: readonly number[]): number {
  if (alphas.length === 0) return 0;
  let product = 1;
  for (const a of alphas) {
    const clamped = Math.min(1, Math.max(0, a));
    product *= 1 - clamped;
  }
  return Math.min(0.7, 1 - product);
}
