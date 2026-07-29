// Public barrel for the canvas tool layer. Server-safe (no React/Konva).

export type {
  ToolKind,
  BrushSize,
  BrushCell,
  BrushBounds,
  BrushStroke,
  PieceProjection,
  PaintStrokeInput,
  EraseStrokeInput,
  PaintedCell,
} from './types';
export {
  MIN_BRUSH_SIZE,
  MAX_BRUSH_SIZE,
  normalizeBrushSize,
  bumpBrushSizeUp,
  bumpBrushSizeDown,
  brushOffsets,
  brushCellsAt,
  computeStrokeCells,
} from './brush';
export { applyPaintStroke } from './paint';
export { applyEraseStroke } from './erase';
