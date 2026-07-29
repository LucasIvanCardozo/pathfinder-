'use client';

import { useEffect } from 'react';

/**
 * Suppresses the browser's native context menu across the whole app, so the
 * Pathfinder editor feels more like a desktop tool. Internal `contextmenu`
 * listeners (e.g. FloorCanvas's right-click → open trait menu) still work
 * because we call `preventDefault` after their handlers run.
 *
 * Inputs and textareas are exempt so users can still right-click to access
 * standard text-editing affordances (paste, spell-check, etc.) where it
 * actually matters.
 */
export function DisableContextMenu() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);
  return null;
}
