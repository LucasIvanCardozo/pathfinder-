// Non-Konva exports. Safe to import from server components.
// For Konva-dependent components (FloorStack, FloorCanvas, WorldGrid),
// import from "@/canvas/konva" via dynamic({ ssr: false }).

export type { SubdivisionConfig } from '@/lib/shared/types';
export { AMBIENT_DEFAULT, AmbientPanel, type AmbientState } from './ambient/AmbientPanel';
export { PaintToolbar } from './components/PaintToolbar';
export { PiecePalette } from './components/PiecePalette';
export { cycleRotationIndex, SpellPalette } from './components/SpellPalette';
export { SubdivisionTabs } from './components/SubdivisionTabs';
export { getMusic, MUSIC_TRACKS, type MusicDef } from './music/registry';
export { useAmbientAudio } from './music/useAmbientAudio';
export type { BrushCell, BrushShape, BrushSize, StrokeFootprint, ToolKind } from './tools';
export {
  applyEraseStroke,
  applyPaintStroke,
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  computeStrokeCells,
  normalizeBrushSize,
} from './tools';
export { defaultEntityStateFor, getInteractiveTrait } from './traits';
export { type Shortcut, useKeyboardShortcuts } from './useKeyboardShortcuts';
export { useTextureImages } from './useTextureImages';
export { getWeather, WEATHERS, type WeatherDef } from './weather/registry';
export { useWeatherAudio } from './weather/useWeatherAudio';
export { WeatherOverlay } from './weather/WeatherOverlay';
