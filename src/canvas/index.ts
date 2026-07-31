// Non-Konva exports. Safe to import from server components.
// For Konva-dependent components (FloorStack, FloorCanvas, WorldGrid),
// import from "@/canvas/konva" via dynamic({ ssr: false }).

export type { SubdivisionConfig } from '@/lib/shared/types';
export type { PaintTool } from './components/PaintToolbar';
export { PaintToolbar } from './components/PaintToolbar';
export { PiecePalette } from './components/PiecePalette';
export { SubdivisionTabs } from './components/SubdivisionTabs';
export type { BrushCell, BrushShape, BrushSize, ToolKind } from './tools';
export {
  applyEraseStroke,
  applyPaintStroke,
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  computeStrokeCells,
  normalizeBrushSize,
} from './tools';
export { defaultEntityStateFor, getInteractiveTrait } from './traits';
export { useKeyboardShortcuts, type Shortcut } from './useKeyboardShortcuts';
export { useTextureImages } from './useTextureImages';
export { getWeather } from './weather/registry';
export { useWeatherAudio } from './weather/useWeatherAudio';
export { WeatherOverlay } from './weather/WeatherOverlay';
export { WEATHER_DEFAULT, WeatherPanel, type WeatherState } from './weather/WeatherPanel';
