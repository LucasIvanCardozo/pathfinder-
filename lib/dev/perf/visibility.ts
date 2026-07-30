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
const NAV_EVENT = 'pathfinder:perf:nav';

let version = 0;
const listeners = new Set<() => void>();
/**
 * Whether the module-level keyboard + history-patching listeners have been
 * attached. Module-level `addEventListener` calls re-attach on every HMR
 * re-evaluation; without a guard, long dev sessions leak listeners and each
 * Ctrl+Shift+P press runs the handler N times.
 */
let listenersInstalled = false;
/**
 * Whether `window.history.pushState` / `replaceState` have been patched.
 * Done once at module load — patching twice corrupts the prototype chain.
 */
let historyPatched = false;

/**
 * Extracted keyboard handler — referenced by the listeners-installed guard
 * and the Ctrl+Shift+P shortcut.
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

if (typeof window !== 'undefined' && !listenersInstalled) {
  listenersInstalled = true;

  window.addEventListener('keydown', keydownHandler);
  // Cross-component synchronisation: any panel can dispatch this event to
  // force a re-render in siblings without prop-drilling.
  window.addEventListener(TOGGLE_EVENT, () => emit());

  // Patch pushState / replaceState so we get a hook for client-side
  // navigation. The patch only dispatches a custom DOM event — the actual
  // `emit()` listener is attached inside `usePerfVisibility`'s useEffect
  // (NOT at module level) to avoid the React
  // "useInsertionEffect must not schedule updates" warning: Next.js calls
  // pushState during its render commit, which lands inside React's
  // insertion phase, and `emit()` runs synchronously here would try to
  // schedule an update from inside that phase.
  if (!historyPatched) {
    historyPatched = true;
    const origPushState = window.history.pushState;
    window.history.pushState = function patched(
      ...args: Parameters<typeof origPushState>
    ): void {
      origPushState.apply(this, args);
      window.dispatchEvent(new Event(NAV_EVENT));
    };
    const origReplaceState = window.history.replaceState;
    window.history.replaceState = function patched(
      ...args: Parameters<typeof origReplaceState>
    ): void {
      origReplaceState.apply(this, args);
      window.dispatchEvent(new Event(NAV_EVENT));
    };
  }
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

  // Storage + nav sync must run inside a useEffect so `emit()` is never
  // invoked from inside React's insertion phase. The patched `pushState`
  // dispatches `pathfinder:perf:nav` synchronously, so listening at module
  // load would call our listeners during the insertion effect that
  // scheduled the navigation in the first place.
  useEffect(() => {
    const onPop = () => emit();
    const onNav = () => emit();
    window.addEventListener('popstate', onPop);
    window.addEventListener(NAV_EVENT, onNav);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener(NAV_EVENT, onNav);
    };
  }, []);

  // Visibility sources are URL `?debug=1` and localStorage flag — no NODE_ENV
  // gate. We want the HUD available in prod too (under opt-in URL flag) so
  // perf work can be measured against the real production bundle via `pnpm
  // start`. The CSS/JS cost of being available-but-hidden is negligible.
  const visible = readQuery() || readStorage();
  return { visible };
}
