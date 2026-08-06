/**
 * Weather configuration. Two halves:
 *
 *   1. `WEATHER_DEFAULT` — the initial state of the weather panel when no
 *      scenario is loaded or when the user clears the weather.
 *   2. `STORM_TIMING` — the multi-phase lightning flash curve drawn by
 *      `StormEffect`. Each phase is (cumulativeEndMs, alpha); the loop reads
 *      the most recent phase whose end is in the future and applies its
 *      alpha to the canvas flash layer.
 *
 * Changing these constants visibly changes the editor's feel: bumping
 * `volume` past 100 does nothing (browser audio caps at 100%); raising
 * `flashDurationMs` makes storms feel longer.
 */

export const WEATHER_DEFAULT = Object.freeze({
  weatherId: 'none',
  volume: 100,
} as const);

/**
 * Multi-phase lightning flash curve. `elapsed >= flashDurationMs` means
 * "flash is over, reset". Earlier phases are the bright primary discharge,
 * mid phases are the secondary lobe + small gaps, later phases are the
 * tertiary pulse + afterglow.
 */
export const STORM_TIMING = Object.freeze({
  flashDurationMs: 600,
  phases: [
    { endMs: 50, alpha: 0.95 }, // primary discharge
    { endMs: 110, alpha: 0 }, // gap
    { endMs: 200, alpha: 0.65 }, // secondary lobe
    { endMs: 260, alpha: 0.05 }, // small gap
    { endMs: 380, alpha: 0.35 }, // tertiary pulse
    { endMs: Infinity, alpha: 0.12 }, // afterglow tail
  ] as const,
  /** Slightly bluish tint — real lightning reads faintly violet-white. */
  flashColor: { r: 225, g: 232, b: 250 },
});
