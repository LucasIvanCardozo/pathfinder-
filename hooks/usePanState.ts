'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PanState = {
  pan: { x: number; y: number };
  setPan: (next: { x: number; y: number }) => void;
  beginPan: (clientX: number, clientY: number) => void;
  isPanning: boolean;
};

/**
 * Owns the canvas pan offset and the drag-start ref. Window-level mouse and
 * touch listeners are registered here so the drag survives the cursor leaving
 * the canvas area. The `panRef` indirection lets `beginPan` read the live
 * pan without listing `pan` in its deps — keeps the callback referentially
 * stable across pan updates.
 */
export function usePanState(): PanState {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Mirror `pan` so `beginPan` (and any in-handler reads) see the latest value
  // without forcing the callback to be recreated.
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const beginPan = useCallback((clientX: number, clientY: number) => {
    // Without `panRef`, `[pan.x, pan.y]` deps would flip `beginPan`
    // on every mousemove during a drag and invalidate FloorCanvas's memo.
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    setIsPanning(true);
  }, []);

  // Window-level mouse listeners so the drag survives the cursor leaving
  // the canvas area.
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const drag = dragStartRef.current;
      setPan({
        x: drag.panX + (e.clientX - drag.mouseX),
        y: drag.panY + (e.clientY - drag.mouseY),
      });
    };
    const handleUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, []);

  // Touch listeners mirror the mouse handlers. Single-finger drag pans; a
  // future two-finger gesture could hook in here for pinch-zoom. `touchmove`
  // is passive so the browser can scroll elsewhere without waiting for JS.
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const drag = dragStartRef.current;
      setPan({
        x: drag.panX + (t.clientX - drag.mouseX),
        y: drag.panY + (t.clientY - drag.mouseY),
      });
    };
    const handleTouchEnd = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return { pan, setPan, beginPan, isPanning };
}
