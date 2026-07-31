'use client';

import { useEffect, useState } from 'react';
import { SHORTCUTS } from '@/lib/shared/constants';

/**
 * Tracks whether the pan modifier (Ctrl) is held. `preventDefault` stops the
 * browser from interpreting Ctrl + click as a context menu or other default
 * action; the `keyup` listener always clears the flag even if the focus has
 * moved.
 *
 * The actual key is read from `SHORTCUTS.panModifier.code` so re-binding the
 * pan modifier (e.g. back to Space) only requires editing the registry.
 */
export function usePanModifier(): boolean {
  const [isPanDown, setIsPanDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === SHORTCUTS.panModifier.code && !e.repeat) {
        e.preventDefault();
        setIsPanDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === SHORTCUTS.panModifier.code) {
        setIsPanDown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return isPanDown;
}