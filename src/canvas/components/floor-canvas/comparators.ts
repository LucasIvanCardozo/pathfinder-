import type { PaintedCell } from '@/lib/shared/types';
import type { Props } from '../FloorCanvas';

/**
 * Shallow-equal for `entityState` records. Trait-menu changes
 * (e.g. door-states: closed -> open) mutate only this field on
 * a single cell; the comparator MUST detect that change or the
 * FloorCanvas memo will skip the render and the door texture
 * stays stale until an unrelated event forces a re-render.
 * `null` and `undefined` are both treated as the empty state.
 */
export function entityStatesEqual(
  a: Record<string, string | number | boolean> | undefined,
  b: Record<string, string | number | boolean> | undefined,
): boolean {
  if (a === b) return true;
  // `noUncheckedIndexedAccess` makes `a[k]` `T | undefined`. Narrow with
  // `b[k]`-aware check: if `b` is missing, the loop already short-circuits.
  const ak = a ? Object.keys(a) : [];
  const bk = b ? Object.keys(b) : [];
  if (ak.length !== bk.length) return false;
  const bNonNull = b as Record<string, string | number | boolean>;
  const aNonNull = a as Record<string, string | number | boolean>;
  for (const k of ak) {
    if (aNonNull[k] !== bNonNull[k]) return false;
  }
  return true;
}

/**
 * Compares PaintedCells field-by-field so an inactive floor's
 * memoized render survives a fresh ref with identical content.
 * `entityState` goes through `entityStatesEqual` so door-state
 * mutations still trigger a re-render.
 */
export function cellsContentEqual(a: PaintedCell[], b: PaintedCell[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y) return false;
    if (x.id !== y.id) return false;
    if (x.floorId !== y.floorId) return false;
    if (x.subdivisionId !== y.subdivisionId) return false;
    if (x.pieceId !== y.pieceId) return false;
    if (x.gridX !== y.gridX) return false;
    if (x.gridY !== y.gridY) return false;
    if (!entityStatesEqual(x.entityState, y.entityState)) return false;
  }
  return true;
}

/**
 * Custom comparator for `React.memo`. Most props are reference-stable;
 * `cells` is the exception (re-bucketed on every paint), so it goes
 * through `cellsContentEqual`. Dev-only `console.warn` fires for inactive
 * floors whose memo would otherwise mask a broken ref chain. DCE'd in prod.
 *
 * When both sides are inactive, a number of props are decorative:
 * - `isPanDown`, `isPanning`, `beginPan`, and the callbacks (`onPaint`,
 *   `onDarknessErase`, `onOpenTraitMenu`): every event handler short-circuits
 *   on `!isActive`, and the cursor is only applied to the active container.
 * - `activeSubdivisionId`, `activePieceId`, `tool`, `darknessMode`,
 *   `brushSize`, `brushShape`, `showBrushPreview`: the brush preview's
 *   `hoverCell` is cleared when `isActive` flips to false (see the
 *   `setHoverCell(null)` effect in `FloorCanvas`), so `previewCells` is
 *   always `[]` for an inactive floor and none of these reach the output.
 *
 * Skipping them prevents the inactive stack from re-rendering on every tool
 * change, brush size/shape toggle, subdivision/piece selection, pan-modifier
 * toggle, or parent callback rebuild.
 */
export function floorCanvasPropsAreEqual(prev: Readonly<Props>, next: Readonly<Props>): boolean {
  const inactiveBothSides = !prev.isActive && !next.isActive;

  if (process.env.NODE_ENV !== 'production') {
    if (!prev.isActive) {
      const changes: string[] = [];
      if (prev.subdivisions !== next.subdivisions) changes.push('subdivisions');
      if (prev.pieces !== next.pieces) changes.push('pieces');
      if (prev.effects !== next.effects) changes.push('effects');
      if (prev.textureImages !== next.textureImages) changes.push('textureImages');
      if (!inactiveBothSides && prev.activeSubdivisionId !== next.activeSubdivisionId)
        changes.push('activeSubdivisionId');
      if (!inactiveBothSides && prev.activePieceId !== next.activePieceId)
        changes.push('activePieceId');
      if (!inactiveBothSides && prev.tool !== next.tool) changes.push('tool');
      if (!inactiveBothSides && prev.darknessMode !== next.darknessMode)
        changes.push('darknessMode');
      if (!inactiveBothSides && prev.brushSize !== next.brushSize) changes.push('brushSize');
      if (!inactiveBothSides && prev.brushShape !== next.brushShape) changes.push('brushShape');
      if (!inactiveBothSides && prev.showBrushPreview !== next.showBrushPreview)
        changes.push('showBrushPreview');
      if (!inactiveBothSides && prev.beginPan !== next.beginPan) changes.push('beginPan');
      if (!inactiveBothSides && prev.isPanDown !== next.isPanDown) changes.push('isPanDown');
      if (!inactiveBothSides && prev.isPanning !== next.isPanning) changes.push('isPanning');
      if (!inactiveBothSides && prev.onPaint !== next.onPaint) changes.push('onPaint');
      if (!inactiveBothSides && prev.onDarknessErase !== next.onDarknessErase)
        changes.push('onDarknessErase');
      if (!inactiveBothSides && prev.onOpenTraitMenu !== next.onOpenTraitMenu)
        changes.push('onOpenTraitMenu');
      if (changes.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[FloorCanvas INACTIVE "${prev.floor.name}"] re-rendering due to: ${changes.join(', ')}`,
        );
      }
    }
  }
  return (
    prev.floor === next.floor &&
    cellsContentEqual(prev.cells, next.cells) &&
    prev.depthFromActive === next.depthFromActive &&
    prev.isActive === next.isActive &&
    prev.mapDims === next.mapDims &&
    prev.subdivisions === next.subdivisions &&
    prev.pieces === next.pieces &&
    (inactiveBothSides || prev.activeSubdivisionId === next.activeSubdivisionId) &&
    (inactiveBothSides || prev.activePieceId === next.activePieceId) &&
    (inactiveBothSides || prev.tool === next.tool) &&
    (inactiveBothSides || prev.darknessMode === next.darknessMode) &&
    (inactiveBothSides || prev.brushSize === next.brushSize) &&
    (inactiveBothSides || prev.brushShape === next.brushShape) &&
    (inactiveBothSides || prev.showBrushPreview === next.showBrushPreview) &&
    prev.textureImages === next.textureImages &&
    prev.viewportSize === next.viewportSize &&
    prev.pan === next.pan &&
    prev.zoom === next.zoom &&
    (inactiveBothSides || prev.beginPan === next.beginPan) &&
    (inactiveBothSides || prev.isPanDown === next.isPanDown) &&
    (inactiveBothSides || prev.isPanning === next.isPanning) &&
    (inactiveBothSides || prev.onPaint === next.onPaint) &&
    (inactiveBothSides || prev.onDarknessErase === next.onDarknessErase) &&
    (inactiveBothSides || prev.onOpenTraitMenu === next.onOpenTraitMenu)
  );
}
