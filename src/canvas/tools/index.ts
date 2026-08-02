// Public barrel for the canvas tool layer. Server-safe (no React/Konva).

export {
  brushCellsAt,
  brushOffsets,
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  computeStrokeCells,
  computeStrokeFootprints,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  normalizeBrushSize,
} from './brush';
export { applyEraseStroke } from './erase';
export { eraseFootprintFor } from './eraseFootprint';
export { applyPaintStroke } from './paint';
export type {
  BrushBounds,
  BrushCell,
  BrushShape,
  BrushSize,
  BrushStroke,
  EraseStrokeInput,
  PaintedCell,
  PaintStrokeInput,
  PieceProjection,
  StrokeFootprint,
  ToolKind,
} from './types';
