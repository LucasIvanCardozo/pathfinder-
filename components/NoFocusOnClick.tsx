'use client';

import { useEffect } from 'react';

/**
 * Suppresses the default focus behavior on mouse click for `<button>` elements
 * across the whole app.
 *
 * Without this, pressing Space after a mouse click on a button (e.g. the
 * zoom in/out buttons in the editor header) re-activates the button, because
 * the HTML spec says Space on a focused button fires a click on keyup. That
 * showed up as "releasing Space after pan changes the zoom" — the button
 * was retaining focus from the previous click and the keyup Space was firing
 * the click handler.
 *
 * Native `<select>` is intentionally NOT handled here. The dropdown opens
 * on mousedown (the browser's activation behavior), so `preventDefault` on
 * mousedown would block the dropdown from opening — the user's primary
 * interaction with the select. The select has a related but different bug
 * (Space on a focused select reopens the dropdown) that can be addressed
 * separately if needed.
 *
 * Keyboard navigation (Tab → focus → Space/Enter → activate) is unaffected:
 * we only suppress the mouse-click focus, not focus itself.
 */
export function NoFocusOnClick() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.target instanceof HTMLButtonElement) {
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, []);
  return null;
}
