/**
 * Ambient panel configuration. Initial state of the popover (clima +
 * música) when no scenario is loaded or when the user clears it.
 *
 * `weatherVolume` and `musicVolume` are 0..100 (browser audio caps at
 * 100%); pushing past 100 does nothing. `musicId: 'none'` is the
 * silence sentinel defined in `src/canvas/music/registry.ts`.
 */
export const AMBIENT_DEFAULT = Object.freeze({
  weatherId: 'none',
  weatherVolume: 100,
  musicId: 'none',
  musicVolume: 100,
} as const);
