import type { EffectKind } from '@/lib/shared/types';

/**
 * Per-shape palette for the AoE effects overlay (PR 2 of
 * `effects-and-combat-tracker`, design §13). Used by:
 *   - the modal editor default colour picker,
 *   - the canvas renderer (the overwrite-able `effect.color` is preferred),
 *   - the shortcuts modal (when it learns the AoE category in PR 4).
 *
 * The `defaultWidthFt` / `defaultDepthFt` are the dimensions the modal pre-fills
 * for a freshly-created effect (design §11.4). The renderers ignore those
 * values (they come from the persisted `effect` row).
 *
 * `dashedStroke` is `true` for shapes that visually call for a dashed border
 * (currently only `wall`); the marker-stroke rule in PR 3+ will gate on this.
 */
export type EffectPaletteEntry = {
  /** Solid fill colour for the marker. Always paired with the alpha-blend cap
   *  (0.7) defined in `resultingAlpha()` when multiple effects overlap. */
  color: string;
  /** Human label for the radio in the modal editor. */
  label: string;
  /** Default width in feet for a freshly-created effect. */
  defaultWidthFt: number;
  /** Default depth (length forward) in feet for a freshly-created effect. */
  defaultDepthFt: number;
  /** When true, the renderer strokes the marker with a dashed outline. */
  dashedStroke: boolean;
};

export const EFFECT_PALETTE: Record<EffectKind, EffectPaletteEntry> = {
  burst: {
    color: '#9ad17c',
    label: 'Burst (explosión puntual)',
    defaultWidthFt: 25,
    defaultDepthFt: 25,
    dashedStroke: false,
  },
  cone: {
    color: '#e08c4a',
    label: 'Cono (a partir del ancla)',
    defaultDepthFt: 25,
    defaultWidthFt: 25,
    dashedStroke: false,
  },
  line: {
    color: '#d35070',
    label: 'Línea (hilo recto)',
    defaultLengthFt: 25,
    defaultWidthFt: 25,
    defaultDepthFt: 25,
    dashedStroke: false,
  } as EffectPaletteEntryWithLength,
  wall: {
    color: '#6c4ab6',
    label: 'Muro (barrera)',
    defaultWidthFt: 25,
    defaultLengthFt: 25,
    defaultDepthFt: 25,
    dashedStroke: true,
  } as EffectPaletteEntryWithLength,
};

// NOTE: `line` and `wall` rows expose `defaultLengthFt` for directional
// shapes. The base `EffectPaletteEntry` does not include it, so we widen
// their type via `EffectPaletteEntryWithLength`. No runtime cast remains.
export type EffectPaletteEntryWithLength = EffectPaletteEntry & {
  defaultLengthFt?: number;
};

/**
 * `EffectPaletteEntry` for the directional shapes (cone / line / wall) — the
 * modal reads `defaultLengthFt` first, then falls back to `defaultDepthFt`,
 * since the shape's "forward" dimension is the one the user is most likely to
 * tweak.
 */
export const DIRECTIONAL_PALETTE: Record<'cone' | 'line' | 'wall', EffectPaletteEntryWithLength> = {
  cone: EFFECT_PALETTE.cone as EffectPaletteEntryWithLength,
  line: EFFECT_PALETTE.line as EffectPaletteEntryWithLength,
  wall: EFFECT_PALETTE.wall as EffectPaletteEntryWithLength,
};

/**
 * Convert a palette entry to its base `EffectPaletteEntry` view. Used by the
 * modal to render the colour swatch without exposing the optional
 * `defaultLengthFt` field to consumers that don't care about it.
 */
export function paletteEntryFor(kind: EffectKind): EffectPaletteEntry {
  return EFFECT_PALETTE[kind];
}

/**
 * Default forward length in feet for a directional shape (cone / line / wall).
 * Falls back to `defaultDepthFt` when the palette entry predates the field.
 */
export function defaultLengthFtFor(kind: EffectKind): number {
  const entry = EFFECT_PALETTE[kind] as EffectPaletteEntryWithLength;
  return entry.defaultLengthFt ?? entry.defaultDepthFt;
}

/**
 * Operational flags. `TICK_ROUND_ENABLED` and `COMBAT_FINALISATION_ENABLED` are
 * documented in design §11.4; PR 1 declared them on `lib/shared/constants/effects.ts`
 * and PR 2 migrates them here so the palette file is the single source of truth
 * for everything effect-shaped on the client.
 */
export const ENABLE_EFFECTS_LAYER = true;
export const TICK_ROUND_ENABLED = true;
export const COMBAT_FINALISATION_ENABLED = false; // PR 4
