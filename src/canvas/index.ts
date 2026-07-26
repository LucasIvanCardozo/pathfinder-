// Non-Konva exports. Safe to import from server components.
// For Konva-dependent components (PaintCanvas, GridLayer),
// import from "@/canvas/konva" via dynamic({ ssr: false }).

export type { SubdivisionConfig } from "@/pieces";
export type { PaintTool } from "./components/PaintToolbar";
export { PaintToolbar } from "./components/PaintToolbar";
export { SubdivisionTabs } from "./components/SubdivisionTabs";
export { PiecePalette } from "./components/PiecePalette";
export type { Shortcut } from "./useKeyboardShortcuts";
export { useKeyboardShortcuts } from "./useKeyboardShortcuts";
export { useTextureImages } from "./useTextureImages";
export {
  traitRegistry,
  getTrait,
  getTextureTraits,
  getInteractiveTrait,
  doorStatesTrait,
  blocksLightTrait,
  DOOR_STATES,
} from "./traits";
export type { TraitImpl, TraitKind, DoorState } from "./traits";

export { WeatherPanel, type WeatherState } from "./weather/WeatherPanel";
export { WeatherOverlay } from "./weather/WeatherOverlay";
export { useWeatherAudio } from "./weather/useWeatherAudio";
export { WEATHERS, getWeather } from "./weather/registry";
export type { WeatherAnimationKind, WeatherDef } from "./weather/registry";