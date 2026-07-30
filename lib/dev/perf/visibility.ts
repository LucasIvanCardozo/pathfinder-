'use client';

/**
 * Dev-only perf-visibility hook. Shared between `PerfHud` and
 * `BenchmarkPanel` so both panels open / close together.
 *
 * Visibility sources (OR-ed):
 *   1. URL query string contains `?debug=1`.
 *   2. `localStorage['pathfinder:perf'] === '1'` — persisted across reloads.
 *   3. Ctrl+Shift+P toggles the localStorage flag and forces a re-render.
 *
 * A module-level `version` counter is bumped on every toggle; `useSyncExternalStore`
 * reads it so all panels re-render in lockstep. The browser listener is
 * installed once at module load and is a no-op in production.
 */
import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'pathfinder:perf';
const TOGGLE_EVENT = 'pathfinder:perf:toggle';

let version = 0;
const listeners = new Set<() => void>();
/**
 * Whether the keyboard + cross-component listeners have been attached to
 * `window`. Module-level `addEventListener` calls re-attach on every HMR
 * re-evaluation; without a guard, long dev sessions leak listeners and each
 * Ctrl+Shift+P press runs the handler N times. Production builds evaluate the
 * module once so the guard has no runtime cost there.
 */
let listenersInstalled = false;

/**
 * Extracted keyboard handler — referenced by the listeners-installed guard
 * and the Ctrl+Shift+P shortcut (still available directly in dev).
 */
function keydownHandler(e: KeyboardEvent): void {
  if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.code === 'KeyP')) {
    e.preventDefault();
    try {
      const current = readStorage();
      if (current) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, '1');
      }
    } catch {
      // Storage may be disabled (Safari private mode); silently ignore.
    }
    emit();
  }
}

function emit(): void {
  version += 1;
  for (const fn of listeners) fn();
}

function readStorage(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function readQuery(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debug') === '1';
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getVersion(): number {
  return version;
}

// Keyboard shortcut + cross-component event listener. Available in both dev
// and prod so Ctrl+Shift+P toggles the HUD in `pnpm start` environments
// (not just when running `pnpm dev`).
if (typeof window !== 'undefined' && !listenersInstalled) {
  listenersInstalled = true;

  window.addEventListener('keydown', keydownHandler);
  // Cross-component synchronisation: any panel can dispatch this event to
  // force a re-render in siblings without prop-drilling.
  window.addEventListener(TOGGLE_EVENT, () => emit());

  // Next.js client-side navigation uses history.pushState / replaceState,
  // which do NOT fire 'popstate'. Subscribe to the patched-pushState hook to
  // make `?debug=1` re-evaluate after navigations (e.g. entering the editor
  // from a scenario list with the query string already set).
  const origPushState = window.history.pushState;
  window.history.pushState = function patched(...args: Parameters<typeof origPushState>) {
    const result = origPushState.apply(this, args);
    window.dispatchEvent(new Event('pathfinder:perf:nav'));
    return result;
  };
  const origReplaceState = window.history.replaceState;
  window.history.replaceState = function patched(...args: Parameters<typeof origReplaceState>) {
    const result = origReplaceState.apply(this, args);
    window.dispatchEvent(new Event('pathfinder:perf:nav'));
    return result;
  };
  window.addEventListener('pathfinder:perf:nav', emit);
}

export function togglePerf(): void {
  if (typeof window === 'undefined') return;
  try {
    const current = readStorage();
    if (current) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
  } catch {
    // Ignore.
  }
  emit();
}

export function usePerfVisibility(): { visible: boolean } {
  // useSyncExternalStore with a changing `version` forces a re-read on every
  // toggle. The snapshot combines URL + localStorage so either input is enough.
  useSyncExternalStore(subscribe, getVersion, getVersion);
  // Keep storage in sync if the URL changes after mount (client-side nav).
  useEffect(() => {
    const onPop = () => emit();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Visibility sources are URL `?debug=1` and localStorage flag — no NODE_ENV
  // gate. We want the HUD available in prod too (under opt-in URL flag) so
  // perf work can be measured against the real production bundle via `pnpm
  // start`. The CSS/JS cost of being available-but-hidden is negligible.
  const visible = readQuery() || readStorage();
  return { visible };
}
