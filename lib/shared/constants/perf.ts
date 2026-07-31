/**
 * Dev/perf instrumentation knobs. The perf HUD / benchmark panel reads these
 * to decide how often to sample, how much history to keep, and how aggressive
 * each scripted scenario is.
 *
 * These constants only affect the perf layer — the application runtime
 * doesn't read them. Bumping `FPS_BUFFER_CAP` increases memory use but lets
 * the HUD chart a longer time window; bumping the `*_MS` intervals makes the
 * HUD less responsive but cheaper on the main thread.
 */

export const PERF = Object.freeze({
  /** Rolling FPS buffer length. 720 samples at 60 fps ≈ 12 seconds of history
   *  for the FPS chart in the HUD. */
  FPS_BUFFER_CAP: 720,
  /** How often `useSyncExternalStore` subscribers get a fresh snapshot from
   *  the telemetry store. 250 ms is the trade-off between chart smoothness
   *  and React render cost on the HUD itself. */
  SUBSCRIBE_INTERVAL_MS: 250,
  /** How often the perf store polls `performance.memory` (Chromium only). */
  MEMORY_POLL_MS: 500,
  /** Quantile for the FPS p95 line in the HUD. */
  FPS_P95_QUANTILE: 0.95,
});

/** Scripted benchmark scenarios (paint-stress / pan-stress / drag-piece). */

export const BENCHMARK = Object.freeze({
  /** Time between synthetic paint events in `paint-stress`. 16 ms targets
   *  ~60 paints/sec so the runtime has enough load to be measurable. */
  PAINT_GAP_MS: 16,
  /** Time between synthetic pan events in `pan-stress`. */
  PAN_GAP_MS: 16,
  /** Default number of paint strokes a `paint-stress` run emits. */
  DEFAULT_PAINT_CELLS: 200,
  /** Default duration of a `pan-stress` run. */
  DEFAULT_PAN_DURATION_MS: 3000,
  /** Default number of drag steps a `drag-piece` run emits. */
  DEFAULT_DRAG_STEPS: 100,
});