/**
 * Style tokens for the brush preview overlay. Kept local to avoid contaminating
 * the global palette with paint-tool-specific colours.
 */
export const PREVIEW_STYLE = {
  paint: { stroke: '#c9a86a', fill: 'rgba(201, 168, 106, 0.25)' },
  erase: { stroke: '#e07a7a', fill: 'rgba(224, 122, 122, 0.2)' },
  // Darkness preview: nearly-opaque black so it previews what the painted
  // darkness cell will look like (the actual cell renders as solid black).
  darkness: { stroke: '#000000', fill: 'rgba(0, 0, 0, 0.5)' },
} as const;
