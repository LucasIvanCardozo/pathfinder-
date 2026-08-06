/**
 * Style tokens for the brush preview overlay. Kept local to avoid contaminating
 * the global palette with paint-tool-specific colours.
 */
export const PREVIEW_STYLE = {
  paint: { stroke: '#c9a86a', fill: 'rgba(201, 168, 106, 0.25)' },
  erase: { stroke: '#e07a7a', fill: 'rgba(224, 122, 122, 0.2)' },
  // Darkness apply preview: nearly-opaque black so it previews what the painted
  // darkness cell will look like (the actual cell renders as solid black).
  darkness: { stroke: '#000000', fill: 'rgba(0, 0, 0, 0.4)' },
  // Darkness erase preview: white. Drawn only over cells that currently
  // carry darkness AND are reachable through walls, so the GM sees exactly
  // which cells the click will reveal. The obscuridad Layer also skips
  // these cells in render so the underlying content is visible underneath
  // the white highlight.
  darknessErase: { stroke: '#000000', fill: 'rgba(0, 0, 0, .5)' },
  // PR 2: `effects` tool preview. The actual marker is drawn by the
  // EffectsLayer, so the brush preview is omitted to avoid double-rendering.
  effects: { stroke: '#6c4ab6', fill: 'rgba(108, 74, 182, 0.18)' },
} as const;

export type PreviewStyleKey = keyof typeof PREVIEW_STYLE;
