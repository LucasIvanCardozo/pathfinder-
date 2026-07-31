/**
 * Performance telemetry singleton. Active in both dev and prod so perf
 * work can be measured against the real production bundle via `pnpm start`.
 * The HUD only displays data when activated via `?debug=1` (see
 * `visibility.ts`); the bookkeeping below always runs so the opt-in flag can
 * surface accumulated data.
 *
 * The bundle cost is ~3KB gzipped and the runtime cost is microseconds per
 * event. Acceptable trade-off for production perf observability.
 *
 * Consumers: `<ProfiledTree>` calls `recordRender`; `<PerfHud>` subscribes via
 * `subscribe` and renders the live counter table; the benchmark harness in
 * `benchmark.ts` calls `recordKonvaDraw` and `recordEvent` directly.
 *
 * `snapshot()` returns a cached, referentially-stable object that is only
 * rebuilt on each subscriber push — this matches React 19's
 * `useSyncExternalStore` requirement that `getSnapshot` be idempotent between
 * store updates.
 */

export type RenderStat = {
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
};

export type FpsStat = {
  avg: number;
  p95: number;
  min: number;
  max: number;
  samples: number;
};

export type PerfSnapshot = {
  timestamp: string;
  durationMs: number;
  fps: FpsStat;
  memory: { usedJSHeapMB: number | null };
  renders: Record<string, RenderStat>;
  events: Record<string, number>;
  konva: { drawCount: number; avgDrawMs: number; maxDrawMs: number };
};

// PERF.* knobs (PERF.FPS_BUFFER_CAP / PERF.SUBSCRIBE_INTERVAL_MS / PERF.MEMORY_POLL_MS /
// FPS_P95_QUANTILE) come from `@/lib/shared/constants/perf.ts` so the perf
// layer is configurable from one place.

type InternalRender = Omit<RenderStat, 'avgMs'>;
type InternalKonva = { drawCount: number; totalMs: number; maxDrawMs: number };

interface State {
  startMs: number;
  fpsBuffer: Float64Array;
  fpsHead: number;
  fpsSize: number;
  renders: Map<string, InternalRender>;
  events: Map<string, number>;
  konva: InternalKonva;
  latestMemoryBytes: number | null;
}

function createEmptyState(): State {
  return {
    startMs: performance.now(),
    fpsBuffer: new Float64Array(PERF.FPS_BUFFER_CAP),
    fpsHead: 0,
    fpsSize: 0,
    renders: new Map(),
    events: new Map(),
    konva: { drawCount: 0, totalMs: 0, maxDrawMs: 0 },
    latestMemoryBytes: null,
  };
}

let state: State = createEmptyState();
let cachedSnapshot: PerfSnapshot | null = null;
/**
 * Set to `true` by every `record*` function, cleared by `pushToSubscribers`.
 * The push timer fires every PERF.SUBSCRIBE_INTERVAL_MS regardless of activity;
 * without this flag, `useSyncExternalStore`-backed PerfHud would be
 * re-rendered four times a second with no actual data change, violating
 * the snapshot-stability contract.
 */
import { PERF } from '@/lib/shared/constants';

let dirty = false;
const subscribers = new Set<(snap: PerfSnapshot) => void>();
let pushTimer: ReturnType<typeof setInterval> | null = null;

function buildSnapshot(): PerfSnapshot {
  // FPS reduction
  const n = state.fpsSize;
  const fps: FpsStat = { avg: 0, p95: 0, min: 0, max: 0, samples: n };
  if (n > 0) {
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    // Walk the ring buffer in chronological order.
    const start = (state.fpsHead - n + PERF.FPS_BUFFER_CAP) % PERF.FPS_BUFFER_CAP;
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      const idx = (start + i) % PERF.FPS_BUFFER_CAP;
      const v = state.fpsBuffer[idx] ?? 0;
      samples.push(v);
      sum += v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    fps.avg = sum / n;
    fps.min = min;
    fps.max = max;
    const sorted = [...samples].sort((a, b) => a - b);
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * PERF.FPS_P95_QUANTILE));
    fps.p95 = sorted[p95Idx] ?? 0;
  }

  // Renders reduction
  const renders: Record<string, RenderStat> = {};
  for (const [id, r] of state.renders) {
    renders[id] = {
      count: r.count,
      totalMs: r.totalMs,
      avgMs: r.count === 0 ? 0 : r.totalMs / r.count,
      maxMs: r.maxMs,
    };
  }

  // Events reduction (already a map of counters; copy for snapshot immutability)
  const events: Record<string, number> = {};
  for (const [name, count] of state.events) events[name] = count;

  const memoryMB =
    state.latestMemoryBytes === null ? null : state.latestMemoryBytes / (1024 * 1024);

  return {
    timestamp: new Date().toISOString(),
    durationMs: performance.now() - state.startMs,
    fps,
    memory: { usedJSHeapMB: memoryMB },
    renders,
    events,
    konva: {
      drawCount: state.konva.drawCount,
      avgDrawMs: state.konva.drawCount === 0 ? 0 : state.konva.totalMs / state.konva.drawCount,
      maxDrawMs: state.konva.maxDrawMs,
    },
  };
}

function getCachedSnapshot(): PerfSnapshot {
  if (cachedSnapshot === null) {
    cachedSnapshot = buildSnapshot();
  }
  return cachedSnapshot;
}

function invalidate(): void {
  cachedSnapshot = null;
}

function pushToSubscribers(): void {
  if (subscribers.size === 0) return;
  if (!dirty) return; // No state changed since last push: keep snapshot stable.
  dirty = false;
  invalidate();
  const snap = getCachedSnapshot();
  for (const fn of subscribers) fn(snap);
}

function ensurePushTimer(): void {
  if (pushTimer !== null) return;
  pushTimer = setInterval(pushToSubscribers, PERF.SUBSCRIBE_INTERVAL_MS);
}

function clearPushTimer(): void {
  if (pushTimer === null) return;
  clearInterval(pushTimer);
  pushTimer = null;
}

/** Increments a counter and accumulates total/max per id. */
function recordRender(id: string, durationMs: number): void {
  const existing = state.renders.get(id);
  if (existing) {
    existing.count += 1;
    existing.totalMs += durationMs;
    if (durationMs > existing.maxMs) existing.maxMs = durationMs;
  } else {
    state.renders.set(id, { count: 1, totalMs: durationMs, maxMs: durationMs });
  }
  invalidate();
  dirty = true;
}

/** Increments a named event counter. Used by event handlers and benchmarks. */
function recordEvent(name: string): void {
  state.events.set(name, (state.events.get(name) ?? 0) + 1);
  invalidate();
  dirty = true;
}

/** Accumulates Konva-layer draw timing. */
function recordKonvaDraw(durationMs: number): void {
  state.konva.drawCount += 1;
  state.konva.totalMs += durationMs;
  if (durationMs > state.konva.maxDrawMs) state.konva.maxDrawMs = durationMs;
  invalidate();
  dirty = true;
}

/** Pushes a sample into the FPS ring buffer. */
function recordFps(fps: number): void {
  if (!Number.isFinite(fps) || fps <= 0) return;
  state.fpsBuffer[state.fpsHead] = fps;
  state.fpsHead = (state.fpsHead + 1) % PERF.FPS_BUFFER_CAP;
  if (state.fpsSize < PERF.FPS_BUFFER_CAP) state.fpsSize += 1;
  invalidate();
  dirty = true;
}

/** Drives the FPS sampler via requestAnimationFrame. Returns a stop function. */
function startSamplingFps(): () => void {

  let stopped = false;
  let lastTime = performance.now();
  let rafId = 0;
  const tick = (now: number): void => {
    if (stopped) return;
    const dt = now - lastTime;
    lastTime = now;
    if (dt > 0) recordFps(1000 / dt);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}

/**
 * Polls `performance.memory.usedJSHeapSize` every 500ms. Returns a no-op stop
 * function when the browser does not expose `performance.memory` (Safari,
 * Firefox without flags, etc.).
 */
function startSamplingMemory(): () => void {

  type PerfMem = { usedJSHeapSize: number };
  const perfMem = (performance as unknown as { memory?: PerfMem }).memory;
  if (!perfMem) return () => {};
  const interval = setInterval(() => {
    const mem = (performance as unknown as { memory?: PerfMem }).memory;
    if (mem && typeof mem.usedJSHeapSize === 'number') {
      state.latestMemoryBytes = mem.usedJSHeapSize;
      invalidate();
      // Memory mutates outside the `record*` family, so it must mark
      // `dirty` itself or the new guard in `pushToSubscribers` drops
      // memory-only updates whenever no sibling record fires in the
      // same 250ms window (e.g. background tab with throttled FPS).
      dirty = true;
    }
  }, PERF.MEMORY_POLL_MS);
  return () => clearInterval(interval);
}

/**
 * Returns a cached, referentially-stable snapshot. The cached object is
 * rebuilt only when a record* function mutates state or the subscribe push
 * fires, which keeps `useSyncExternalStore` happy.
 */
function snapshot(): PerfSnapshot {
  return getCachedSnapshot();
}

/** Clears every counter and resets the start timestamp. */
function reset(): void {
  state = createEmptyState();
  invalidate();
  dirty = true;
  pushToSubscribers();
}

/** Subscribes to snapshot pushes (every ~250ms). Returns an unsubscribe fn. */
function subscribe(fn: (snap: PerfSnapshot) => void): () => void {

  subscribers.add(fn);
  ensurePushTimer();
  // Push the current snapshot immediately so the UI does not flash an empty
  // state until the first interval tick.
  fn(getCachedSnapshot());
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) clearPushTimer();
  };
}


export const telemetry = {
  recordRender,
  recordEvent,
  recordKonvaDraw,
  recordFps,
  startSamplingFps,
  startSamplingMemory,
  snapshot,
  reset,
  subscribe,
};
