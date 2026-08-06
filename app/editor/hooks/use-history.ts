'use client';

import { useCallback, useMemo, useRef } from 'react';

type HistoryOptions = {
  /** Maximum number of snapshots kept in the past stack. Older entries are dropped. */
  max?: number;
};

type HistoryStack<T> = {
  past: T[];
  future: T[];
};

/**
 * Generic snapshot-based undo/redo hook for client-only editors.
 *
 * Why a ref: history bookkeeping is invisible to React. The editor never needs
 * to re-render when a snapshot is recorded or popped — only when the user
 * actually calls undo/redo (which already triggers a `setState`). Keeping the
 * stack in `useRef` avoids spurious re-renders on every paint stroke.
 *
 * `record(state)` should be called **before** a mutation with the current state
 * so `undo()` can restore it. Recording invalidates `future` (any redo path
 * is gone after a fresh edit — the canonical behaviour).
 */
export function useHistory<T>({ max = 100 }: HistoryOptions = {}) {
  const stackRef = useRef<HistoryStack<T>>({ past: [], future: [] });

  const record = useCallback(
    (state: T) => {
      const stack = stackRef.current;
      const past = stack.past.length >= max ? stack.past.slice(1) : stack.past;
      stackRef.current = { past: [...past, state], future: [] };
    },
    [max],
  );

  const undo = useCallback((current: T): T | null => {
    const stack = stackRef.current;
    const previous = stack.past[stack.past.length - 1];
    if (previous === undefined) return null;
    stackRef.current = {
      past: stack.past.slice(0, -1),
      future: [...stack.future, current],
    };
    return previous;
  }, []);

  const redo = useCallback((current: T): T | null => {
    const stack = stackRef.current;
    const next = stack.future[stack.future.length - 1];
    if (next === undefined) return null;
    stackRef.current = {
      past: [...stack.past, current],
      future: stack.future.slice(0, -1),
    };
    return next;
  }, []);

  const canUndo = useCallback(() => stackRef.current.past.length > 0, []);
  const canRedo = useCallback(() => stackRef.current.future.length > 0, []);
  const clear = useCallback(() => {
    stackRef.current = { past: [], future: [] };
  }, []);
  const size = useCallback(() => {
    const stack = stackRef.current;
    return stack.past.length + stack.future.length;
  }, []);

  return useMemo(
    () => ({ record, undo, redo, canUndo, canRedo, clear, size }),
    [record, undo, redo, canUndo, canRedo, clear, size],
  );
}
