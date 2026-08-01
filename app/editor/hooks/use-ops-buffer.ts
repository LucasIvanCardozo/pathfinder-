'use client';

import { useCallback, useRef, useState } from 'react';
import type { ScenarioOp } from '@/lib/shared/types';

/**
 * Accumulates `ScenarioOp`s produced by editor mutations. Each push* helper
 * records a single user action; the autosave hook drains the buffer and ships
 * it in one `saveScenarioOps` request. O(1) per push, preserves user order,
 * keys off ops (not paintedCells) so the buffer never grows with the scenario.
 */
export function useOpsBuffer() {
  const [ops, setOps] = useState<ScenarioOp[]>([]);
  // Mirror of `ops` for synchronous reads inside event handlers (where
  // `setOps` updates aren't visible yet). Lets pushers batch in a single
  // handler without losing ops.
  const opsRef = useRef<ScenarioOp[]>([]);
  // When `markDirtyForRebase` is set, the next `drain()` returns [] and
  // resets the flag. Buffer state is stale relative to the editor after an
  // undo (the buffer still holds the op we just reverted), so the next
  // autosave must skip them — otherwise the server would re-apply them
  // and diverge from the local state.
  const needsRebaseRef = useRef(false);

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
      // Coalesce: if the previous op was also `setScenarioName`, replace it.
      // Every-keystroke saves would otherwise generate one op per character.
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
   * hook calls this right before shipping; a failed save leaves the ops in
   * place for the next attempt via `restore`.
   */
  const drain = useCallback((): ScenarioOp[] => {
    if (needsRebaseRef.current) {
      // The buffer is stale (the editor just undid one or more pending
      // mutations). Drop everything so the server doesn't re-apply ops the
      // user already reverted. v1.1: implement a real rebase that maps the
      // stale ops against the undone state instead of dropping them — for
      // now, the next user mutation seeds a fresh diff from the server.
      needsRebaseRef.current = false;
      opsRef.current = [];
      setOps([]);
      return [];
    }
    const drained = opsRef.current;
    opsRef.current = [];
    setOps([]);
    return drained;
  }, []);

  /**
   * Restore ops back into the buffer (server rejected a save). Prepends so
   * the user's chronological order is preserved.
   */
  const restore = useCallback((replay: ScenarioOp[]) => {
    opsRef.current = [...replay, ...opsRef.current];
    setOps(opsRef.current);
  }, []);

  /**
   * Mark the buffer as stale (called after an undo). The next `drain()`
   * returns [] and clears the flag — pending ops are dropped because they
   * no longer match the editor's state.
   */
  const markDirtyForRebase = useCallback(() => {
    needsRebaseRef.current = true;
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
    markDirtyForRebase,
  };
}