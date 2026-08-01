// Shared types for the paint/erase tool layer. No React, no Konva.

import type { BRUSH_SHAPES } from '@/lib/shared/constants';
import type { PaintedCell, Piece } from '@/lib/shared/types';

/** Which tool is currently active. `paint` writes a piece; `erase` clears;
 *  `darkness` toggles the special `obscured` subdivision (left-click = paint,
 *  right-click = erase). */
export type ToolKind = 'paint' | 'erase' | 'darkness';

/**
 * Brush footprint size measured in subdivision cells along one edge. Always a
 * positive odd integer (1, 3, 5, ...) so the footprint has a unique centre
 * cell — even sizes would have four centre candidates and a non-deterministic
 * stroke shape.
 */
export type BrushSize = number;

/**
 * Geometric shape of the brush footprint. Mirrors the `BRUSH_SHAPES` const
 * array in `@/lib/shared/constants/brush` so adding a new shape is a
 * single-source-of-truth edit. The `brushOffsets` cache and the PaintToolbar
 * segmented control both key off this union.
 */
export type BrushShape = (typeof BRUSH_SHAPES)[number];

/** A single grid cell at integer coordinates inside the active subdivision. */
export type BrushCell = { gridX: number; gridY: number };

/** Map bounds in subdivision-cell units (not world pixels). */
export type BrushBounds = { maxX: number; maxY: number };

/**
 * A stroke carries every cell touched by a single drag gesture from the
 * FloorCanvas up to the editor. All cells share the same `floorId` and
 * `subdivisionId` — the tool layer never mixes subdivisions in one stroke.
 */
export type BrushStroke = {
  floorId: string;
  subdivisionId: string;
  cells: BrushCell[];
};

/**
 * Minimal piece projection used by the tool layer. Mirrors the subset of
 * fields the paint logic needs from `Piece`. Keeping the projection narrow
 * lets call sites pass either a real piece or a stub for tests.
 */
export type PieceProjection = Pick<Piece, 'id' | 'traits'>;

export type PaintStrokeInput = {
  stroke: BrushStroke;
  pieceId: string;
  pieceById: ReadonlyMap<string, PieceProjection>;
  /** Painted cells BEFORE the stroke. */
  paintedCells: ReadonlyArray<PaintedCell>;
  /** ID generator; injected so tests can produce deterministic IDs. */
  generateId: () => string;
};

export type EraseStrokeInput = {
  stroke: BrushStroke;
  /** Painted cells BEFORE the stroke. */
  paintedCells: ReadonlyArray<PaintedCell>;
};

// Re-export the domain type so callers don't need to import two paths.
export type { PaintedCell };
