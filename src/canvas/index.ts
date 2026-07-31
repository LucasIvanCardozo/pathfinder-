// Non-Konva exports. Safe to import from server components.
// For Konva-dependent components (FloorStack, FloorCanvas, WorldGrid),
// import from "@/canvas/konva" via dynamic({ ssr: false }).

export type { SubdivisionConfig } from '@/lib/shared/types';
export type { PaintTool } from './components/PaintToolbar';
export { PaintToolbar } from './components/PaintToolbar';
export { PiecePalette } from './components/PiecePalette';
export { SubdivisionTabs } from './components/SubdivisionTabs';
export type {
  BrushBounds,
  BrushCell,
  BrushShape,
  BrushSize,
  BrushStroke,
  EraseStrokeInput,
  PaintStrokeInput,
  PieceProjection,
  ToolKind,
} from './tools';
export {
  applyEraseStroke,
  applyPaintStroke,
  brushCellsAt,
  brushOffsets,
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  computeStrokeCells,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  normalizeBrushSize,
} from './tools';
export type { DoorState, TraitImpl, TraitKind } from './traits';
export {
  blocksLightTrait,
  DOOR_STATES,
  defaultEntityStateFor,
  doorStatesTrait,
  getInteractiveTrait,
  getTextureTraits,
  getTrait,
  traitRegistry,
} from './traits';
export type { Shortcut } from './useKeyboardShortcuts';
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useTextureImages } from './useTextureImages';
export type { WeatherAnimationKind, WeatherDef } from './weather/registry';
export { getWeather, WEATHERS } from './weather/registry';
export { useWeatherAudio } from './weather/useWeatherAudio';
export { WeatherOverlay } from './weather/WeatherOverlay';
export { WEATHER_DEFAULT, WeatherPanel, type WeatherState } from './weather/WeatherPanel';
