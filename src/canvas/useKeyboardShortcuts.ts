'use client';

import { useEffect, useRef } from 'react';

export type Shortcut = {
  /** Lowercase key or special name like "Escape", "ArrowUp".
   *  Matched against `KeyboardEvent.key`. */
  key?: string;
  /** Physical key code like "Space", "Digit1".
   *  Matched against `KeyboardEvent.code`. Required for non-character keys
   *  (Space, Tab) where `e.key` is ambiguous or unprintable. */
  code?: string;
  /** Require Ctrl or Cmd. */
  ctrl?: boolean;
  /** Require Shift. */
  shift?: boolean;
  handler: () => void;
  /**
   * If true, the shortcut fires even when an input/textarea/contentEditable
   * is focused. Default false — most shortcuts should be inert while typing.
   */
  allowInInputs?: boolean;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * Registers global keyboard shortcuts on `document`. Listens at the capture
 * phase so handlers run before the browser's own shortcuts (e.g. Ctrl+S
 * for "save page" is preventDefault'd before it fires).
 *
 * The latest `shortcuts` array is always honored via a ref, so callers
 * don't need to memoize the array on every render.
 */
export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  options: { enabled?: boolean } = {},
): void {
  const { enabled = true } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      for (const shortcut of shortcutsRef.current) {
        if (!shortcut.allowInInputs && isTypingTarget(target)) return;
        // Prefer `code` when present — it's the physical key identifier,
        // which is unambiguous for keys like Space where `e.key` is `' '`.
        // Fall back to `key` (case-insensitive) for character-bound
        // shortcuts like 'b', 'Escape', 'ArrowUp'.
        const codeMatches = shortcut.code !== undefined && e.code === shortcut.code;
        const keyMatches =
          shortcut.key !== undefined && e.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!codeMatches && !keyMatches) continue;
        const ctrlMatches = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        if (!ctrlMatches) continue;
        const shiftMatches = !!shortcut.shift === e.shiftKey;
        if (!shiftMatches) continue;
        e.preventDefault();
        e.stopPropagation();
        shortcut.handler();
        return;
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [enabled]);
}
