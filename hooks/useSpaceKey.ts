'use client';

import { useEffect, useState } from 'react';
import { SHORTCUTS } from '@/lib/shared/constants';

/**
 * Tracks whether the pan modifier (space) is held. `preventDefault` stops the
 * browser from scrolling the page when space is held; the `keyup` listener
 * always clears the flag even if the focus has moved.
 */
export function useSpaceKey(): boolean {
  const [isSpaceDown, setIsSpaceDown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === SHORTCUTS.panModifier.code && !e.repeat) {
        e.preventDefault();
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === SHORTCUTS.panModifier.code) {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return isSpaceDown;
}
