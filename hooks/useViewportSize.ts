'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';

/**
 * Tracks the pixel size of the supplied container via a `ResizeObserver` and
 * exposes a stable `{ viewportSize, containerRef }` pair. The container ref is
 * stable across renders; the viewport size follows the DOM.
 */
export function useViewportSize(): {
  viewportSize: { width: number; height: number };
  containerRef: RefObject<HTMLDivElement | null>;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  return { viewportSize, containerRef };
}
