import type { ScenarioEffect } from '@/lib/shared/types';
import type { BrushCell } from '../tools/types';
import { SPELL_TEMPLATES } from './spell-templates';

// =============================================================================
// Spell footprint geometry (PR 1 of the spellcasting refactor).
//
// Each `effect.templateId` resolves to a template in `spell-templates.ts`
// carrying a list of `figures` (visual variants — e.g. cardinal and
// NE-diagonal for cones, single matrix for circles). `effect.rotationIndex`
// interleaves figures by parity and step by stride: with N figures,
// `figureIdx = rotationIndex % N` and `quarterTurn = Math.floor(idx / N)`.
// The walker picks `template.figures[figureIdx]` as the active shape and
// rotates its cells around its pivot by `quarterTurn` quarter-turns
// (0/1/2/3 → 0/90/180/270, 90° clockwise in screen coords).
//
// This is uniform across all templates — a cone with two figures cycles
// through 8 states (cardinal ↔ NE-diagonal each click), a circle with
// one figure cycles through 4 (visually invariant due to symmetry). No
// parity gate is hardcoded for 2 figures; the math scales to whatever
// number of figures the template declares. The shape never shifts
// relative to the anchor; only the rotation and the active matrix change
// per click.
//
// For `cellSizeRatio = 1` (the active subdivision is `suelo`, the common
// case) the output matches the legacy cone/circle walker exactly. For
// other ratios the shape scales affinely with the ratio instead of
// regenerating a `halfCells` ramp — the shape in cells stays invariant,
// the active-cell layout differs. Spell rendering happens on `suelo` in
// practice, so this is a non-issue in the running app.
// =============================================================================

/**
 * Compute the per-cell footprint for one spell. Resolves
 * `effect.templateId` to a template, picks the active figure via
 * `rotationIndex % figures.length`, picks the quarter-turn via
 * `Math.floor(rotationIndex / figures.length)`, rotates every `1` cell's
 * offset around the figure's pivot, and applies `cellSizeRatio` as an
 * affine scale around the anchor cell.
 *
 * `cellSizeRatio` is the active subdivision's `base cells per
 * active-subdivision cell` (e.g. 1 for `suelo`, 2 for `objetos-grandes`).
 *
 * The returned cells are an *over-estimate* — the wall-aware BFS in
 * `useEffectMarkers` post-filters them via `eraseFootprintFor` so cells
 * behind a structure wall are dropped.
 */
export function computeEffectFootprint(effect: ScenarioEffect, cellSizeRatio: number): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  const template = SPELL_TEMPLATES.find((t) => t.id === effect.templateId);
  if (!template) return [];
  const rotationIndex = Math.max(
    0,
    Math.min(template.figures.length * 4 - 1, Math.round(effect.rotationIndex)),
  );
  // Decompose `rotationIndex` so the cycle interleaves figures. For N
  // figures, the figure index repeats every N states (parity via
  // `idx % N`) and the quarter-turn advances every Nth state (via
  // `floor(idx / N)`). Two figures → cardinal ↔ NE-diagonal each click
  // (~45° visual step). One figure (circles) → quarter-turn only (visually
  // invariant due to symmetry).
  const n = template.figures.length;
  const figureIdx = rotationIndex % n;
  const figure = template.figures[figureIdx];
  if (!figure) return [];
  const times = Math.floor(rotationIndex / n);
  const cells: BrushCell[] = [];
  const originX = Math.round(effect.originCellX);
  const originY = Math.round(effect.originCellY);
  for (let row = 0; row < figure.matrix.length; row++) {
    const rowCells = figure.matrix[row];
    if (!rowCells) continue;
    for (let col = 0; col < rowCells.length; col++) {
      if (rowCells[col] !== 1) continue;
      // Offset from pivot, in matrix coordinates.
      const offsetCol = col - figure.pivot.col;
      const offsetRow = row - figure.pivot.row;
      // Rotate 90° clockwise in screen coords (Y grows downward).
      // (offsetCol, offsetRow) → (-offsetRow, offsetCol)
      let rc = offsetCol;
      let rr = offsetRow;
      for (let i = 0; i < times; i++) {
        [rc, rr] = [-rr, rc];
      }
      cells.push({
        gridX: originX + Math.round(rc * cellSizeRatio),
        gridY: originY + Math.round(rr * cellSizeRatio),
      });
    }
  }
  return cells;
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
