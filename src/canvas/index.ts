// Non-Konva exports. Safe to import from server components.
// For Konva-dependent components (PaintCanvas, GridLayer, DoorLayer),
// import from "@/canvas/konva" via dynamic({ ssr: false }).

export type { SubdivisionConfig } from "@/pieces";
export type { PaintTool } from "./components/PaintToolbar";
export { PaintToolbar } from "./components/PaintToolbar";
export { SubdivisionTabs } from "./components/SubdivisionTabs";
export { TexturePalette } from "./components/TexturePalette";
export {
  ALL_DOOR_STATES,
  doorStateLabel,
  doorStateToTextureId,
  textureIdToState,
} from "./doorTexture";
export {
  DEFAULT_SUBDIVISION_ID,
  DOORS_SUBDIVISION_NAME,
  filterVisibleSubdivisions,
  isDoorsSubdivision,
} from "./subdivisions";
export type { Shortcut } from "./useKeyboardShortcuts";
export { useKeyboardShortcuts } from "./useKeyboardShortcuts";
export { useTextureImages } from "./useTextureImages";
