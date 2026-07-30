'use client';

/**
 * Dev-only performance HUD.
 *
 * Visibility is shared with `BenchmarkPanel` via `usePerfVisibility`. When
 * shown, the HUD mounts a `stats.js` canvas panel (FPS / MS / MB) inside its
 * own fixed container and renders a live table of render counts and event
 * counters.
 *
 * The HUD drives the FPS and memory samplers via `telemetry.startSampling*` and
 * reads live snapshot pushes via `useSyncExternalStore(telemetry.subscribe,
 * telemetry.snapshot)`. The component is dev-only: in production builds the
 * early `return null` branch is dead-code-eliminated.
 *
 * Dev-only gate: Next.js inlines `process.env.NODE_ENV` at build time and the
 * unreachable branch is eliminated by the bundler.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createStatsHud, type StatsHud } from './hud';
import styles from './perf.module.css';
import type { PerfSnapshot } from './telemetry';
import { telemetry } from './telemetry';
import { usePerfVisibility } from './visibility';

const STORAGE_KEY = 'pathfinder:perf';

function downloadSnapshot(snap: PerfSnapshot): void {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `perf-snapshot-${iso}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatMs(ms: number): string {
  if (ms >= 100) return ms.toFixed(0);
  if (ms >= 10) return ms.toFixed(1);
  return ms.toFixed(2);
}

function formatMb(mb: number | null): string {
  if (mb === null) return '—';
  if (mb >= 100) return `${mb.toFixed(0)} MB`;
  return `${mb.toFixed(1)} MB`;
}

/** Server snapshot is `null` — the panel has no meaningful server-rendered
 *  state and hydration replaces it with a live snapshot on first push. */
function getServerSnapshot(): PerfSnapshot | null {
  return null;
}

/** Bridges telemetry's snapshot-pushing subscribe to React's
 *  `useSyncExternalStore` contract. The push payload is intentionally
 *  discarded — React calls `getSnapshot` after the notification. */
function subscribeToTelemetry(onChange: () => void): () => void {
  return telemetry.subscribe(() => onChange());
}

export function PerfHud() {
  // Visibility is gated by `?debug=1` / Ctrl+Shift+P (see `usePerfVisibility`).
  // We intentionally do NOT short-circuit on `NODE_ENV === 'production'` so
  // that perf work can be measured against the real production bundle via
  // `pnpm start`. The HUD adds overhead only when activated, never by
  // default in prod (no `?debug=1` → `visible=false` → returns `null`).
  return <PerfHudImpl />;
}

function PerfHudImpl() {
  // SSR hydration guard: `usePerfVisibility` reads `window.location.search` and
  // `localStorage`, both of which are `undefined`/empty on the server. To keep
  // server-rendered HTML and the client's first render identical we return
  // `null` until the effect fires (i.e. the component is actually mounted in
  // the browser). After that the visibility hook can run with real state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { visible } = usePerfVisibility();
  const snap = useSyncExternalStore(subscribeToTelemetry, telemetry.snapshot, getServerSnapshot);
  const statsRef = useRef<StatsHud | null>(null);
  const stopFpsRef = useRef<(() => void) | null>(null);
  const stopMemRef = useRef<(() => void) | null>(null);

  // Mount the FPS sampler and memory sampler exactly once.
  useEffect(() => {
    stopFpsRef.current = telemetry.startSamplingFps();
    stopMemRef.current = telemetry.startSamplingMemory();
    return () => {
      stopFpsRef.current?.();
      stopMemRef.current?.();
      stopFpsRef.current = null;
      stopMemRef.current = null;
    };
  }, []);

  // Mount / unmount the stats.js HUD when visibility flips. The HUD sits in a
  // portal-style host appended to <body> so its `position:fixed` is anchored
  // to the viewport (the lib's inline CSS sets `position:fixed;top:0`).
  useEffect(() => {
    if (!visible) {
      statsRef.current?.end();
      statsRef.current?.destroy();
      statsRef.current = null;
      return;
    }
    const host = document.createElement('div');
    host.className = styles.statsHost ?? '';
    document.body.appendChild(host);
    const hud = createStatsHud(host);
    hud.begin();
    statsRef.current = hud;
    return () => {
      hud.end();
      hud.destroy();
      host.remove();
      statsRef.current = null;
    };
  }, [visible]);

  if (!mounted) return null;
  if (!visible) return null;

  const renderRows = snap
    ? Object.entries(snap.renders)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
    : [];
  const eventRows = snap ? Object.entries(snap.events).sort((a, b) => b[1] - a[1]) : [];

  return (
    <section className={styles.hud} aria-label="Performance HUD">
      <header className={styles.hudHeader}>
        <span className={styles.title}>Perf HUD</span>
        <span className={styles.hint}>Ctrl+Shift+P</span>
      </header>
      <div className={styles.metricsRow}>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>FPS</span>
          <span className={styles.metricValue}>
            {snap ? `${snap.fps.avg.toFixed(0)} avg` : '—'}
          </span>
        </span>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>Frame</span>
          <span className={styles.metricValue}>
            {snap ? `${formatMs(1000 / Math.max(1, snap.fps.avg))} ms` : '—'}
          </span>
        </span>
        <span className={styles.metric}>
          <span className={styles.metricLabel}>Mem</span>
          <span className={styles.metricValue}>
            {snap ? formatMb(snap.memory.usedJSHeapMB) : '—'}
          </span>
        </span>
      </div>
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.button}
          onClick={() => snap && downloadSnapshot(snap)}
          disabled={!snap}
        >
          Export snapshot
        </button>
        <button type="button" className={styles.button} onClick={() => telemetry.reset()}>
          Reset
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            try {
              window.localStorage.removeItem(STORAGE_KEY);
              window.location.reload();
            } catch {
              // Ignore.
            }
          }}
          title="Hide the HUD"
        >
          Hide
        </button>
      </div>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Renders (top 10)</h4>
        {renderRows.length === 0 ? (
          <p className={styles.empty}>No render samples yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>id</th>
                <th>count</th>
                <th>avg ms</th>
                <th>max ms</th>
              </tr>
            </thead>
            <tbody>
              {renderRows.map(([id, stat]) => (
                <tr key={id}>
                  <td className={styles.idCell} title={id}>
                    {id}
                  </td>
                  <td>{stat.count}</td>
                  <td>{formatMs(stat.avgMs)}</td>
                  <td>{formatMs(stat.maxMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Events</h4>
        {eventRows.length === 0 ? (
          <p className={styles.empty}>No events yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>name</th>
                <th>count</th>
              </tr>
            </thead>
            <tbody>
              {eventRows.map(([name, count]) => (
                <tr key={name}>
                  <td className={styles.idCell} title={name}>
                    {name}
                  </td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
