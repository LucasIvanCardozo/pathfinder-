import type { ScenarioEffect } from '@/lib/shared/types';
import type { BrushCell } from '../tools/types';
import { SPELL_TEMPLATES } from './spell-templates';

// =============================================================================
// Spell footprint geometry (PR 1 of the spellcasting refactor).
//
// Each `effect.templateId` resolves to a template in `spell-templates.ts`
// carrying a 1/0 matrix and an explicit pivot cell. The walker enumerates
// every `1` cell, rotates its offset around the pivot by `effect.rotationDeg`
// (snapped to 0/90/180/270, 90° clockwise in screen coords), and applies
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
 * to a template (matrix + pivot), rotates every cell's offset around the
 * pivot by `effect.rotationDeg`, and applies `cellSizeRatio` as an affine
 * scale around the anchor cell.
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
  const cells: BrushCell[] = [];
  const times = ((Math.round(effect.rotationDeg / 90) % 4) + 4) % 4;
  const originX = Math.round(effect.originCellX);
  const originY = Math.round(effect.originCellY);
  for (let row = 0; row < template.matrix.length; row++) {
    const rowCells = template.matrix[row];
    if (!rowCells) continue;
    for (let col = 0; col < rowCells.length; col++) {
      if (rowCells[col] !== 1) continue;
      // Offset from pivot, in matrix coordinates.
      const offsetCol = col - template.pivot.col;
      const offsetRow = row - template.pivot.row;
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
