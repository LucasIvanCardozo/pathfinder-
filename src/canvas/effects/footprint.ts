import type { ScenarioEffect } from '@/lib/shared/types';
import { FEET_PER_BASE_CELL } from '@/lib/shared/constants';
import type { BrushCell } from '../tools/types';

// =============================================================================
// Effect footprint geometry (PR 2 of effects-and-combat-tracker, design §13).
//
// Coordinates:
// - `effect.originCellX` / `effect.originCellY` are in *active-subdivision
//   grid cells* (whole numbers, 1-indexed by the user but 0-indexed in math).
//   The modal pre-fills them with the `gridX` / `gridY` of the cell the GM
//   clicked; the persisted row stores the integer as a Prisma `Float`.
// - `effect.widthFt` / `effect.depthFt` are in *feet*. One base cell is 5 ft
//   (`FEET_PER_BASE_CELL`). To convert feet into active-subdivision cells
//   we apply the active subdivision's `cellSizeRatio`:
//     widthInActiveSubCells = (widthFt / FEET_PER_BASE_CELL) * cellSizeRatio
//   For ratio=1 subdivisions (suelo, estructuras, obscured) this collapses
//   to the intuitive `widthFt / 5`; for ratio=2 (objetos-grandes) and
//   ratio=4 (objetos-pequenos) the per-subdivision cell is correspondingly
//   smaller (so 5 ft always corresponds to one *base* cell on the map).
// - `effect.rotationDeg` is a free rotation in degrees clockwise from
//   +Y (north). The cone / line / wall walkers account for it by rotating the
//   direction unit vector before walking; the burst is a rectangle in marker
//   space and the rotation is currently a no-op (PR 4 may rotate the burst's
//   bounding box if requested).
//
// All four shape functions take `cellSizeRatio` (base cells per
// active-subdivision cell) and return a `BrushCell[]` in active-subdivision
// grid space. The renderer emits one `<Rect>` per cell with the colour from
// `effect.color` and the alpha from `resultingAlpha(...)` (T2.6).
// =============================================================================

/**
 * Direction unit vector for a rotation in degrees clockwise from +Y (north).
 * Cone / line / wall walk along this vector for the shape's forward length;
 * the width fan-out is perpendicular to it.
 */
function directionFor(rotationDeg: number): { dx: number; dy: number } {
  // `rotationDeg === 0` → pointing toward +Y (visually "south" because the
  // canvas Y axis grows downward). The user thinks of north as "up" on the
  // map, so +Y matches the camera's frame.
  const rad = (rotationDeg * Math.PI) / 180;
  // Y axis is flipped (screen coords) so we negate sin to keep clockwise
  // rotation visually correct.
  return { dx: Math.sin(rad), dy: Math.cos(rad) };
}

/**
 * Rotate a vector by 90° clockwise in screen space (perpendicular to the
 * direction vector, on the "right-hand" side of the walker).
 */
function perpRight(d: { dx: number; dy: number }): { dx: number; dy: number } {
  return { dx: d.dy, dy: -d.dx };
}

/**
 * Bresenham 8-connected walk from `start` to `end`, inclusive. Reused for the
 * cone / line / wall walkers; the same algorithm lives in `eraseFootprint.ts`
 * for the darkness erase but inlining here keeps the effect footprint
 * dependency-free.
 */
function bresenhamLine(start: BrushCell, end: BrushCell): BrushCell[] {
  const out: BrushCell[] = [];
  let x0 = start.gridX;
  let y0 = start.gridY;
  const x1 = end.gridX;
  const y1 = end.gridY;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const cap = Math.max(dx, dy) + 2;
  for (let i = 0; i <= cap; i++) {
    out.push({ gridX: x0, gridY: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

/**
 * Burst / explosion centred on the anchor. The PR 1 default was a rectangle
 * of `widthFt × depthFt` worth of cells; PR 2 keeps the rectangle (per design §13.2 the
 * "circle" semantics are out of scope for this PR — the renderer will use a
 * solid rectangle for the burst for the foreseeable future). The anchor cell
 * is always included so the marker is visible even when the dimensions
 * collapse to a single cell.
 */
function burstFootprint(
  effect: ScenarioEffect,
  cellSizeRatio: number,
): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  if (effect.widthFt <= 0 || effect.depthFt <= 0) return [];
  const anchorX = Math.round(effect.originCellX);
  const anchorY = Math.round(effect.originCellY);
  const halfWidthCells = Math.max(
    0,
    Math.floor((effect.widthFt * cellSizeRatio) / FEET_PER_BASE_CELL / 2),
  );
  const halfDepthCells = Math.max(
    0,
    Math.floor((effect.depthFt * cellSizeRatio) / FEET_PER_BASE_CELL / 2),
  );
  const cells: BrushCell[] = [];
  for (let dx = -halfWidthCells; dx <= halfWidthCells; dx++) {
    for (let dy = -halfDepthCells; dy <= halfDepthCells; dy++) {
      cells.push({ gridX: anchorX + dx, gridY: anchorY + dy });
    }
  }
  return cells;
}

/**
 * Cone / directional fan from the anchor. Bresenham-walk `depthFt` cells along
 * the direction, and for each step expand the perpendicular footprint by
 * `widthFt / 2` cells on each side (the width grows linearly from 0 at the
 * anchor to `widthFt` at the tip and stays there). Over-inclusive by one cell
 * on the diagonal (design §16.5) — kept as a known property.
 */
function coneFootprint(effect: ScenarioEffect, cellSizeRatio: number): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  if (effect.depthFt <= 0) return [];
  const anchorX = Math.round(effect.originCellX);
  const anchorY = Math.round(effect.originCellY);
  const lengthCells = Math.max(
    1,
    Math.floor((effect.depthFt * cellSizeRatio) / FEET_PER_BASE_CELL),
  );
  const dir = directionFor(effect.rotationDeg);
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
    // Width at this step: linear ramp from 0 (anchor) to `widthFt` worth of
    // cells. Each "foot of width" maps to `cellSizeRatio / FEET_PER_BASE_CELL`
    // active-subdivision cells, so we scale by both.
    const halfCells = Math.max(
      0,
      Math.floor(
        ((effect.widthFt * cellSizeRatio) / FEET_PER_BASE_CELL / 2) * (step / lengthCells),
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
 * Line / ray from the anchor. Bresenham-walk `depthFt` cells along the
 * direction; a short Bresenham walk of `widthFt` cells perpendicular gives
 * the line its thickness. The anchor cell is always included.
 */
function lineFootprint(effect: ScenarioEffect, cellSizeRatio: number): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  if (effect.depthFt <= 0) return [];
  const anchorX = Math.round(effect.originCellX);
  const anchorY = Math.round(effect.originCellY);
  const lengthCells = Math.max(
    1,
    Math.floor((effect.depthFt * cellSizeRatio) / FEET_PER_BASE_CELL),
  );
  const halfThicknessCells = Math.max(
    0,
    Math.floor((effect.widthFt * cellSizeRatio) / FEET_PER_BASE_CELL / 2),
  );
  const dir = directionFor(effect.rotationDeg);
  const perp = perpRight(dir);
  const endpoint = {
    gridX: anchorX + Math.round(dir.dx * lengthCells),
    gridY: anchorY + Math.round(dir.dy * lengthCells),
  };
  const line = bresenhamLine({ gridX: anchorX, gridY: anchorY }, endpoint);
  const cells: BrushCell[] = [];
  const seen = new Set<string>();
  const add = (gx: number, gy: number) => {
    const key = `${gx}|${gy}`;
    if (seen.has(key)) return;
    seen.add(key);
    cells.push({ gridX: gx, gridY: gy });
  };
  for (const { gridX, gridY } of line) {
    for (let w = -halfThicknessCells; w <= halfThicknessCells; w++) {
      add(gridX + Math.round(perp.dx * w), gridY + Math.round(perp.dy * w));
    }
  }
  return cells;
}

/**
 * Wall / barrier. Rectangle of `depthFt` (length) × `widthFt` (thickness)
 * cells, oriented by `rotationDeg`. Implementation note: the walker aligns
 * the rectangle's long axis along the direction unit vector and its short
 * axis along the perpendicular. The Bresenham walks for the four corners are
 * collapsed by emitting every cell in the bounding rectangle of the four
 * corner coords — this is exact for a rotated rectangle and avoids the
 * gaps that a per-step perpendicular fan would leave at the corners.
 */
function wallFootprint(effect: ScenarioEffect, cellSizeRatio: number): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  if (effect.depthFt <= 0 || effect.widthFt <= 0) return [];
  const anchorX = Math.round(effect.originCellX);
  const anchorY = Math.round(effect.originCellY);
  const lengthCells = Math.max(
    1,
    Math.floor((effect.depthFt * cellSizeRatio) / FEET_PER_BASE_CELL),
  );
  const halfThicknessCells = Math.max(
    0,
    Math.floor((effect.widthFt * cellSizeRatio) / FEET_PER_BASE_CELL / 2),
  );
  const dir = directionFor(effect.rotationDeg);
  const perp = perpRight(dir);
  const corners: BrushCell[] = [
    { gridX: anchorX + Math.round(dir.dx * lengthCells) + Math.round(perp.dx * halfThicknessCells), gridY: anchorY + Math.round(dir.dy * lengthCells) + Math.round(perp.dy * halfThicknessCells) },
    { gridX: anchorX + Math.round(dir.dx * lengthCells) - Math.round(perp.dx * halfThicknessCells), gridY: anchorY + Math.round(dir.dy * lengthCells) - Math.round(perp.dy * halfThicknessCells) },
    { gridX: anchorX - Math.round(perp.dx * halfThicknessCells), gridY: anchorY - Math.round(perp.dy * halfThicknessCells) },
    { gridX: anchorX + Math.round(perp.dx * halfThicknessCells), gridY: anchorY + Math.round(perp.dy * halfThicknessCells) },
  ];
  const minX = Math.min(...corners.map((c) => c.gridX));
  const maxX = Math.max(...corners.map((c) => c.gridX));
  const minY = Math.min(...corners.map((c) => c.gridY));
  const maxY = Math.max(...corners.map((c) => c.gridY));
  const cells: BrushCell[] = [];
  for (let gx = minX; gx <= maxX; gx++) {
    for (let gy = minY; gy <= maxY; gy++) {
      cells.push({ gridX: gx, gridY: gy });
    }
  }
  return cells;
}

/**
 * Compute the per-cell footprint for one effect in the active subdivision's
 * grid space. Dispatches on `effect.kind` to the shape-specific walker above.
 * The `cellSizeRatio` is the active subdivision's `base cells per
 * active-subdivision cell` (e.g. 1 for `suelo`, 2 for `objetos-grandes`,
 * 4 for `objetos-pequenos`).
 *
 * The returned cells are an *over-estimate* — the wall-aware BFS in
 * `useEffectMarkers` post-filters them via `eraseFootprintFor` so cells
 * behind a structure wall are dropped. The wall walker returns the full
 * rectangle so the BFS has the right starting geometry.
 */
export function computeEffectFootprint(
  effect: ScenarioEffect,
  cellSizeRatio: number,
): BrushCell[] {
  switch (effect.kind) {
    case 'burst':
      return burstFootprint(effect, cellSizeRatio);
    case 'cone':
      return coneFootprint(effect, cellSizeRatio);
    case 'line':
      return lineFootprint(effect, cellSizeRatio);
    case 'wall':
      return wallFootprint(effect, cellSizeRatio);
    default: {
      const _exhaustive: never = effect.kind;
      return [];
    }
  }
}

/**
 * Per-cell alpha-blend cap math. Each effect contributes its base alpha
 * (overlap ratio clipped to 1; for v1 the base alpha is hardcoded at 0.35
 * per effect and the composite is capped at 0.7). The formula is the
 * standard "over" blend: `1 - Π(1 - aᵢ)`.
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
