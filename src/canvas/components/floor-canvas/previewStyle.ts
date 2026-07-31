/**
 * Style tokens for the brush preview overlay. Kept local to avoid contaminating
 * the global palette with paint-tool-specific colours.
 */
export const PREVIEW_STYLE = {
  paint: { stroke: '#c9a86a', fill: 'rgba(201, 168, 106, 0.25)' },
  erase: { stroke: '#e07a7a', fill: 'rgba(224, 122, 122, 0.2)' },
} as const;
