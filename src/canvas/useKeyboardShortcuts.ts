'use client';

import { useEffect, useRef } from 'react';

export type Shortcut = {
  /** Lowercase key or special name like "Escape", "ArrowUp".
   *  Matched against `KeyboardEvent.key` (case-insensitive). */
  key?: string;
  /** Physical key code like "KeyB", "BracketLeft", "Digit1".
   *  Matched against `KeyboardEvent.code`. Use `code` whenever possible — it's
   *  layout-independent between US, LATAM, UK, German, French and most other
   *  QWERTY-based layouts (the key's *position* is the same even when the
   *  character it produces differs). */
  code?: string;
  /** Require Ctrl or Cmd. */
  ctrl?: boolean;
  /**
   * When `undefined` (the default), the shortcut matches with or without Shift.
   * This is what you want for bindings to characters that require Shift on
   * some layouts but not others (e.g. `?` on US is `Shift+/`).
   *
   * Set to `true` only when the shortcut must distinguish Shift state from
   * another binding on the same physical key (e.g. `B` paint vs `Shift+B`
   * toggle brush shape). The matching loop processes explicit-shift shortcuts
   * first so the conflict resolves deterministically.
   */
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
      // Process shortcuts with explicit `shift` first so a `Shift+B` binding
      // wins over a `B` binding on the same physical key. Within each group,
      // declaration order is honored.
      const current = shortcutsRef.current;
      const explicit = current.filter((s) => s.shift !== undefined);
      const agnostic = current.filter((s) => s.shift === undefined);
      const ordered = explicit.concat(agnostic);
      for (const shortcut of ordered) {
        if (!shortcut.allowInInputs && isTypingTarget(target)) return;
        const codeMatches = shortcut.code !== undefined && e.code === shortcut.code;
        const keyMatches =
          shortcut.key !== undefined && e.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!codeMatches && !keyMatches) continue;
        const ctrlMatches = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
        if (!ctrlMatches) continue;
        // Shift is enforced only when the shortcut declares it explicitly.
        // When `shift` is undefined, both Shift-down and Shift-up match — this
        // is what makes `?` (Shift+/ in US/LATAM) work without the consumer
        // having to declare `shift: true` for layout-specific reasons.
        if (shortcut.shift !== undefined) {
          const shiftMatches = !!shortcut.shift === e.shiftKey;
          if (!shiftMatches) continue;
        }
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
