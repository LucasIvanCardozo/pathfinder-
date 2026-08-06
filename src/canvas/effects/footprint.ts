import type { ScenarioEffect } from '@/lib/shared/types';
import type { BrushCell } from '../tools/types';
import { SPELL_TEMPLATES } from './spell-templates';

// =============================================================================
// Spell footprint geometry (PR 1 of the spellcasting refactor).
//
// Each `effect.templateId` resolves to a template in `spell-templates.ts`
// carrying TWO 1/0 matrices (cardinal and diagonal) plus their pivot cells.
// `effect.rotationIndex` (0..7) drives the runtime selection: even indices
// pick the cardinal matrix, odd indices pick the diagonal one (the
// `rotationIndex % 2 === 1` parity gate), and `Math.floor(rotationIndex / 2)`
// is the quarter-turn count within the chosen parity (0/1/2/3 → 0/90/180/270,
// 90° clockwise in screen coords). This pairs the two matrices without
// authoring eight separate shapes — the cardinal and diagonal cells aren't
// reachable by a 90° rotation of one matrix around the other's pivot, so we
// keep both literal. Circles repeat the same matrix on both slots, so cycling
// the index is a no-op for them.
//
// The walker enumerates every `1` cell, rotates its offset around the pivot
// by `Math.floor(rotationIndex / 2)` quarter-turns, and applies
// `cellSizeRatio` as an affine scale around the anchor.
//
// For `cellSizeRatio = 1` (the active subdivision is `suelo`, the common case)
// the output matches the legacy cone/circle walker exactly. For other ratios
// the shape scales affinely with the ratio instead of regenerating a
// halfCells ramp — the shape in cells stays invariant, the active-cell layout
// differs. Spell rendering happens on `suelo` in practice, so this is a
// non-issue in the running app.
// =============================================================================

/**
 * Compute the per-cell footprint for one spell. Resolves `effect.templateId`
 * to a template (cardinal + diagonal matrices + pivots), selects the active
 * shape via `effect.rotationIndex` (parity picks the orientation,
 * `Math.floor(idx / 2)` picks the quarter-turn within that parity), rotates
 * every cell's offset around the pivot, and applies `cellSizeRatio` as an
 * affine scale around the anchor cell.
 *
 * `cellSizeRatio` is the active subdivision's `base cells per
 * active-subdivision cell` (e.g. 1 for `suelo`, 2 for `objetos-grandes`).
 *
 * The returned cells are an *over-estimate* — the wall-aware BFS in
 * `useEffectMarkers` post-filters them via `eraseFootprintFor` so cells
 * behind a structure wall are dropped.
 */
export function computeEffectFootprint(
  effect: ScenarioEffect,
  cellSizeRatio: number,
): BrushCell[] {
  if (cellSizeRatio <= 0) return [];
  const template = SPELL_TEMPLATES.find((t) => t.id === effect.templateId);
  if (!template) return [];
  const rotationIndex = Math.max(0, Math.min(7, Math.round(effect.rotationIndex)));
  // Parity picks the orientation (0/2/4/6 → cardinal, 1/3/5/7 → diagonal).
  // `Math.floor(idx / 2)` is the quarter-turn count within the chosen
  // parity: cardinal: 0→0°, 2→90°, 4→180°, 6→270°; diagonal: 1→0°,
  // 3→90°, 5→180°, 7→270° in NE-diag matrix coords. Each adjacent state
  // pair is a ~45° visual step.
  const shape = rotationIndex % 2 === 1 ? template.diagonal : template.cardinal;
  const times = Math.floor(rotationIndex / 2);
  const cells: BrushCell[] = [];
  const originX = Math.round(effect.originCellX);
  const originY = Math.round(effect.originCellY);
  for (let row = 0; row < shape.matrix.length; row++) {
    const rowCells = shape.matrix[row];
    if (!rowCells) continue;
    for (let col = 0; col < rowCells.length; col++) {
      if (rowCells[col] !== 1) continue;
      // Offset from pivot, in matrix coordinates.
      const offsetCol = col - shape.pivot.col;
      const offsetRow = row - shape.pivot.row;
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
