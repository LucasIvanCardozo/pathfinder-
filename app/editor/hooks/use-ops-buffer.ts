'use client';

import { useCallback, useRef, useState } from 'react';
import type { ScenarioOp } from '@/lib/shared/types';

/**
 * Accumulator for `ScenarioOp`s produced by editor mutations. Each handler
 * (`handlePaint`, `handleClearFloor`, etc.) calls one of the `push*` helpers
 * to record what changed; the autosave hook drains the buffer and ships it
 * to the server inside a single `saveScenarioOps` request.
 *
 * Why a buffer (and not a derived diff from `paintedCells[]`):
 *   - O(1) per push, regardless of how many cells exist
 *   - Order is preserved exactly as the user produced it (important for
 *     paint-then-erase on the same id)
 *   - No "deduplication" logic on the client (every op ships verbatim)
 *   - Each op carries only its own delta; the array never grows with the
 *     scenario
 *
 * Edge case: `clearAllCells` resets the buffer after pushing itself, so the
 * next save is one op instead of "clear + N additions if the user keeps
 * painting right after clearing".
 */
export function useOpsBuffer() {
  const [ops, setOps] = useState<ScenarioOp[]>([]);
  /**
   * Mirror of `ops` for synchronous reads inside event handlers (where
   * `setOps` updates aren't visible yet). Lets us batch pushes inside a
   * single handler without losing any ops.
   */
  const opsRef = useRef<ScenarioOp[]>([]);

  const syncPush = useCallback((op: ScenarioOp) => {
    opsRef.current = [...opsRef.current, op];
    setOps(opsRef.current);
  }, []);

  const pushPaint = useCallback(
    (
      floorId: string,
      subdivisionId: string,
      cells: Array<{
        id: string;
        gridX: number;
        gridY: number;
        pieceId: string;
        entityState?: Record<string, string | number | boolean>;
      }>,
    ) => {
      if (cells.length === 0) return;
      syncPush({ type: 'paintCells', floorId, subdivisionId, cells });
    },
    [syncPush],
  );

  const pushErase = useCallback(
    (cellIds: string[]) => {
      if (cellIds.length === 0) return;
      syncPush({ type: 'eraseCells', cellIds });
    },
    [syncPush],
  );

  const pushEntityState = useCallback(
    (cellId: string, entityState: Record<string, string | number | boolean> | null) => {
      syncPush({ type: 'setEntityState', cellId, entityState });
    },
    [syncPush],
  );

  const pushClearAll = useCallback(() => {
    // Replace the entire buffer with just `clearAllCells`. The previous ops
    // are semantically covered by this single op (the server is about to
    // delete every row), so shipping them would be wasted bandwidth.
    //
    // IMPORTANT: do NOT `syncPush + opsRef.current = []` here. That pattern
    // would put `clearAllCells` in the buffer and then immediately wipe it,
    // so the next `drain` would return [] and the server would never receive
    // the op — the scenario would remain unchanged on save (caught in the
    // op-based autosave refactor; user-reported as "Borrar todo no persiste").
    opsRef.current = [{ type: 'clearAllCells' }];
    setOps(opsRef.current);
  }, []);

  const pushClearFloor = useCallback(
    (floorId: string) => {
      syncPush({ type: 'clearFloor', floorId });
    },
    [syncPush],
  );

  const pushClearSubdivision = useCallback(
    (floorId: string, subdivisionId: string) => {
      syncPush({ type: 'clearSubdivision', floorId, subdivisionId });
    },
    [syncPush],
  );

  const pushAddFloor = useCallback(
    (floor: { id: string; name: string }, position: 'above' | 'below') => {
      syncPush({ type: 'addFloor', floor, position });
    },
    [syncPush],
  );

  const pushScenarioName = useCallback(
    (name: string) => {
      // Coalesce: if the previous op was also a `setScenarioName`, replace
      // it with the latest value. Saves on every keystroke would otherwise
      // generate one op per character.
      const current = opsRef.current;
      const last = current[current.length - 1];
      const next: ScenarioOp[] =
        last?.type === 'setScenarioName'
          ? [...current.slice(0, -1), { type: 'setScenarioName', name }]
          : [...current, { type: 'setScenarioName', name }];
      opsRef.current = next;
      setOps(next);
    },
    [],
  );

  /**
   * Returns the current ops and clears the buffer atomically. The autosave
   * hook calls this right before shipping the request, so a save that fails
   * server-side leaves the ops in place for the next attempt.
   */
  const drain = useCallback((): ScenarioOp[] => {
    const drained = opsRef.current;
    opsRef.current = [];
    setOps([]);
    return drained;
  }, []);

  /**
   * Restore ops back into the buffer. Called when the server rejects a save
   * (`result.success === false`) so the next autosave tick re-tries them.
   * Prepends so the user's chronological order is preserved.
   */
  const restore = useCallback((replay: ScenarioOp[]) => {
    opsRef.current = [...replay, ...opsRef.current];
    setOps(opsRef.current);
  }, []);

  return {
    ops,
    pushPaint,
    pushErase,
    pushEntityState,
    pushClearAll,
    pushClearFloor,
    pushClearSubdivision,
    pushAddFloor,
    pushScenarioName,
    drain,
    restore,
  };
}