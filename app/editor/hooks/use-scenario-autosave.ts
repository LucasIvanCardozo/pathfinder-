import { useCallback, useEffect, useRef, useState } from 'react';
import { saveScenarioOps } from '@/lib/server/actions/scenario.action';
import { AUTOSAVE_INTERVAL_MS, SAVE_TIMEOUT_MS } from '@/lib/shared/constants';
import type { Floor, PaintedCell, ScenarioOp, ScenarioSaveRequest } from '@/lib/shared/types';
import type { useOpsBuffer } from './use-ops-buffer';

type UseScenarioAutosaveParams = {
  scenarioName: string;
  scenarioId: string | null;
  mapDims: { baseCellSize: number; width: number; height: number };
  floors: Floor[];
  paintedCells: PaintedCell[];
  isDirty: boolean;
  opsBuffer: ReturnType<typeof useOpsBuffer>;
  /**
   * `updatedAt` of the scenario as the client last saw it. Used as
   * `baselineVersion` in the save request so the server has a stable
   * concurrency token (last-write-wins today; ready for optimistic
   * concurrency checks later).
   */
  baselineVersion: string | null;
  /** Called with the server-returned `updatedAt` after a successful save. */
  onSaved: (savedId: string, newVersion: string) => void;
  /**
   * Demo mode skips every write — the editor is open to unauthenticated
   * visitors and the surface has no save controls, but the autosave
   * interval still ticks, so `save` short-circuits here as the single
   * condition that gates persistence.
   */
  isDemo?: boolean;
};

type Status = 'idle' | 'saving' | 'saved' | 'timeout' | 'error';

type UseScenarioAutosaveResult = {
  isSaving: boolean;
  autosaveStatus: Status;
  savedAt: string | null;
  save: (isAutosave?: boolean) => void;
};

export function useScenarioAutosave({
  scenarioName,
  scenarioId,
  mapDims,
  floors,
  paintedCells,
  isDirty,
  opsBuffer,
  baselineVersion,
  onSaved,
  isDemo,
}: UseScenarioAutosaveParams): UseScenarioAutosaveResult {
  const [isSaving, setIsSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<Status>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /**
   * Holds the active `AbortController` so a newer save can cancel an
   * in-flight one (e.g. user clicks Guardar while an autosave is still
   * pending). `null` when no save is running.
   */
  const abortRef = useRef<AbortController | null>(null);

  // Mirror frequently-changing inputs in refs so `save` doesn't get
  // recreated (and the autosave `useEffect` doesn't re-run its interval)
  // on every paint / scenario-name keystroke / baselineVersion bump.
  const paintedCellsRef = useRef(paintedCells);
  paintedCellsRef.current = paintedCells;
  const floorsRef = useRef(floors);
  floorsRef.current = floors;
  // `useOpsBuffer` returns a fresh object on every render; destructuring
  // the (stable) pushers keeps `save` referentially stable.
  const { drain: drainOps, restore: restoreOps } = opsBuffer;

  // biome-ignore lint/correctness/useExhaustiveDependencies: drainOps/restoreOps are destructured from opsBuffer and are stable across renders; adding opsBuffer would invalidate the callback every render.
  const save = useCallback(
    (isAutosave = false) => {
      if (isAutosave && !isDirty) return;
      // Demo mode: never write. The autosave interval in the editor still
      // ticks, so this guard is the single condition that prevents any
      // mutation from reaching the server.
      if (isDemo) return;

      // Cancel any in-flight save to avoid two saves racing on
      // `setAutosaveStatus('saved')` and flickering the badge.
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      // Hard ceiling on the round-trip. If the server doesn't respond
      // within SAVE_TIMEOUT_MS the request is aborted and we surface
      // 'timeout' so the user knows the autosave didn't land.
      const timeoutId = setTimeout(() => abort.abort('save-timeout'), SAVE_TIMEOUT_MS);

      // Apply loading state OUTSIDE any React transition: wrapping in
      // `startTransition` (as the previous version did) marks the
      // setter as low-priority — the transition only resolves after
      // the await, by which time `finally` has cleared `isSaving`.
      setAutosaveStatus('saving');
      setIsSaving(true);

      (async () => {
        // Drain the ops buffer atomically before shipping. If the save
        // fails we restore the same list back into the buffer.
        const ops = opsBuffer.drain();

        const request: ScenarioSaveRequest = {
          scenarioId,
          baselineVersion,
          ops,
          // First save: ship the full state alongside an empty ops list so
          // the server can seed the scenario.
          initialState:
            scenarioId === null
              ? {
                  name: scenarioName,
                  baseCellSize: mapDims.baseCellSize,
                  width: mapDims.width,
                  height: mapDims.height,
                  floors: floorsRef.current,
                  paintedCells: paintedCellsRef.current,
                }
              : undefined,
        };

        try {
          const result = await saveScenarioOps(request);
          if (abort.signal.aborted) return;
          if (!result.success) {
            // Server rejected — keep ops in the buffer so the next
            // attempt re-tries them, not just whatever the user does next.
            opsBuffer.restore(ops);
            setAutosaveStatus('error');
            return;
          }
          setSavedAt(new Date().toLocaleTimeString('es'));
          setAutosaveStatus('saved');
          onSaved(result.data.id, result.data.updatedAt.toISOString());
        } catch {
          opsBuffer.restore(ops);
          if (abort.signal.aborted && abort.signal.reason === 'save-timeout') {
            setAutosaveStatus('timeout');
          } else {
            setAutosaveStatus('error');
          }
        } finally {
          clearTimeout(timeoutId);
          // Always clear `isSaving` — checking `abortRef.current === abort`
          // would race with the cleanup effect: `save` is recreated
          // whenever `baselineVersion` changes (after every successful
          // save), and the cleanup aborts the current controller too.
          // Clearing unconditionally is safe because a newer save re-sets
          // the flag synchronously before its own await starts.
          setIsSaving(false);
          if (abortRef.current === abort) {
            abortRef.current = null;
          }
        }
      })();
    },
    [
      isDirty,
      isDemo,
      scenarioId,
      scenarioName,
      mapDims,
      baselineVersion,
      onSaved,
      drainOps,
      restoreOps,
    ],
  );

  useEffect(() => {
    const id = setInterval(() => {
      if (isDirty) save(true);
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      // Intentionally NOT aborting in-flight saves here. The autosave
      // interval is recreated when `save` is recreated (which happens
      // every `baselineVersion` change). Aborting on cleanup would race
      // with the save's own `finally` and leave the spinner stuck on
      // even after a successful save. Saves are cancelled when a newer
      // one starts (inside `save`) or on unmount (see below).
    };
  }, [isDirty, save]);

  // Cancel in-flight save on unmount only — single-instance via `[]`.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Demo mode: the editor surface hides save controls, but the autosave
  // interval still ticks. Return inert defaults so callers never see a
  // saving/spinner state and `save` is a no-op for the keyboard shortcut
  // path too.
  if (isDemo) {
    return { isSaving: false, autosaveStatus: 'idle', savedAt: null, save: () => {} };
  }

  return { isSaving, autosaveStatus, savedAt, save };
}

// Re-export `ScenarioOp` so callers can type their op buffer without
// importing from `@/lib/shared/types` separately.
export type { ScenarioOp };
