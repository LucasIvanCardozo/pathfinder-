// Non-Konva exports. Safe to import from server components.
// For Konva-dependent components (PaintCanvas, GridLayer, DoorLayer),
// import from "@/canvas/konva" via dynamic({ ssr: false }).
export { PaintToolbar } from "./components/PaintToolbar";
export { SubdivisionTabs } from "./components/SubdivisionTabs";
export { TexturePalette } from "./components/TexturePalette";
export type { PaintTool } from "./components/PaintToolbar";
export {
  doorStateToTextureId,
  textureIdToState,
  doorStateLabel,
  ALL_DOOR_STATES,
} from "./doorTexture";
export {
  DOORS_SUBDIVISION_NAME,
  isDoorsSubdivision,
  filterVisibleSubdivisions,
  DEFAULT_SUBDIVISION_ID,
} from "./subdivisions";
export type { SubdivisionConfig } from "@/pieces";

export { useTextureImages } from "./useTextureImages";
export { useKeyboardShortcuts } from "./useKeyboardShortcuts";
export type { Shortcut } from "./useKeyboardShortcuts";
