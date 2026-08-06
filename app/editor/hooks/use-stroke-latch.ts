'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * One-shot latch that collapses a pointer drag into a single undo step.
 *
 * Armed on every `pointerdown`; `consume()` returns `true` exactly once per
 * press. Callers record history only when it returns `true`, so the first
 * *effective* mutation of a stroke opens the undo step and the rest of the
 * drag folds into it.
 *
 * Why not gate on the mousedown tick (`isDragging === false`) instead: when the
 * initial click is a no-op — repainting a cell that already carries the same
 * piece, or starting on an out-of-bounds pixel — the paint handler returns
 * before mutating, and the first real change lands on a later pointermove. A
 * tick-based gate would drop the undo step for that stroke entirely.
 */
export function useStrokeLatch(): () => boolean {
  const armedRef = useRef(false);

  useEffect(() => {
    const arm = () => {
      armedRef.current = true;
    };
    // Capture phase so the latch is armed before any Konva/React handler in
    // the subtree runs and calls `consume()` on the same press.
    window.addEventListener('pointerdown', arm, { capture: true });
    return () => window.removeEventListener('pointerdown', arm, { capture: true });
  }, []);

  return useCallback((): boolean => {
    if (!armedRef.current) return false;
    armedRef.current = false;
    return true;
  }, []);
}
