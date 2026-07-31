/**
 * Canonical keyboard event names, grouped by purpose.
 *
 * Two different identifier systems show up on every `KeyboardEvent`:
 *
 *   - `key`  — the *logical* value: the character produced, or a name for
 *     non-character keys (`'a'`, `'A'`, `'Enter'`, `'Escape'`, `'ArrowUp'`).
 *     Case depends on Shift state; for shortcut matching, lowercase the key
 *     before comparing (which `useKeyboardShortcuts` does for you).
 *   - `code` — the *physical* key identifier: where the finger is on the
 *     keyboard, independent of layout or Shift (`'KeyA'`, `'Digit1'`,
 *     `'Space'`, `'ArrowUp'`). Use this when you need a key whose `key`
 *     is unprintable or ambiguous (Space, Tab, function keys) or when you
 *     want layout-independent matching.
 *
 * For modifiers (`ctrl`, `shift`) the registry uses **booleans** — set
 * `ctrl: true` to require Ctrl (or Cmd on Mac, see the hook). There is no
 * "ctrl key" string to bind to because Cmd-vs-Ctrl is handled at the OS
 * level via `e.ctrlKey || e.metaKey` in `useKeyboardShortcuts`.
 *
 * This file doesn't try to be an exhaustive list (the Web platform has
 * hundreds of code values). It covers the keys Pathfinder actually uses.
 * Add new entries here when a new shortcut needs them.
 *
 * Reference specs:
 *   - https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
 *   - https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
 */

/**
 * Logical key values for `KeyboardEvent.key`. Use these for character-bound
 * shortcuts like letters, digits, and named keys (`'Escape'`, `'Enter'`).
 *
 * Lowercase is intentional: `useKeyboardShortcuts` lowercases `e.key` before
 * comparing, so writing `'escape'` (this constant) matches an Escape press
 * regardless of Shift state.
 */
export const KEYS = {
  // Letters
  a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', g: 'g', h: 'h', i: 'i',
  j: 'j', k: 'k', l: 'l', m: 'm', n: 'n', o: 'o', p: 'p', q: 'q', r: 'r',
  s: 's', t: 't', u: 'u', v: 'v', w: 'w', x: 'x', y: 'y', z: 'z',

  // Digits
  d0: '0', d1: '1', d2: '2', d3: '3', d4: '4',
  d5: '5', d6: '6', d7: '7', d8: '8', d9: '9',

  // Punctuation / bracket keys we use (`[` / `]` for brush size)
  leftBracket: '[',
  rightBracket: ']',
  equals: '=',
  minus: '-',
  plus: '+',

  // Named keys
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  space: ' ', // `e.key` for the space bar is the literal space character
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
  arrowLeft: 'ArrowLeft',
  arrowRight: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageUp: 'PageUp',
  pageDown: 'PageDown',

  // Function keys
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6',
  f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',
} as const;

/**
 * Physical key codes for `KeyboardEvent.code`. Use these for shortcuts that
 * should be layout-independent or whose `key` is awkward (Space, Tab,
 * function keys).
 *
 * `KEYS_BY_CODE` is a separate constant so editors autocomplete values
 * for both fields independently — `KEYS.space` (the character `' '`) and
 * `KEYS_BY_CODE.space` (the physical `'Space'`) are deliberately distinct.
 */
export const KEYS_BY_CODE = {
  // Letters (use `code` when you want "the A key" regardless of layout)
  keyA: 'KeyA', keyB: 'KeyB', keyC: 'KeyC', keyD: 'KeyD', keyE: 'KeyE',
  keyF: 'KeyF', keyG: 'KeyG', keyH: 'KeyH', keyI: 'KeyI', keyJ: 'KeyJ',
  keyK: 'KeyK', keyL: 'KeyL', keyM: 'KeyM', keyN: 'KeyN', keyO: 'KeyO',
  keyP: 'KeyP', keyQ: 'KeyQ', keyR: 'KeyR', keyS: 'KeyS', keyT: 'KeyT',
  keyU: 'KeyU', keyV: 'KeyV', keyW: 'KeyW', keyX: 'KeyX', keyY: 'KeyY',
  keyZ: 'KeyZ',

  // Digits
  digit0: 'Digit0', digit1: 'Digit1', digit2: 'Digit2', digit3: 'Digit3',
  digit4: 'Digit4', digit5: 'Digit5', digit6: 'Digit6', digit7: 'Digit7',
  digit8: 'Digit8', digit9: 'Digit9',

  // Punctuation
  bracketLeft: 'BracketLeft',
  bracketRight: 'BracketRight',
  equal: 'Equal',
  minus: 'Minus',

  // Whitespace and editing
  space: 'Space',
  enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',

  // Navigation
  arrowUp: 'ArrowUp',
  arrowDown: 'ArrowDown',
  arrowLeft: 'ArrowLeft',
  arrowRight: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageUp: 'PageUp',
  pageDown: 'PageDown',

  // Function keys
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5', f6: 'F6',
  f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10', f11: 'F11', f12: 'F12',

  // Modifier keys (rarely used as the primary key, but useful for tracking)
  controlLeft: 'ControlLeft',
  controlRight: 'ControlRight',
  shiftLeft: 'ShiftLeft',
  shiftRight: 'ShiftRight',
  metaLeft: 'MetaLeft',
  metaRight: 'MetaRight',
  altLeft: 'AltLeft',
  altRight: 'AltRight',
} as const;

/**
 * `ctrl` and `shift` in `ShortcutBinding` are **booleans**, not strings.
 * There is no "ctrl" key to bind to — set `ctrl: true` to require that the
 * user held Ctrl (or Cmd on Mac) when pressing the bound key.
 *
 * This constant is exported for documentation / discoverability; nothing in
 * the runtime actually reads it.
 */
export const MODIFIER_HELP = {
  ctrl: 'boolean — require Ctrl (or Cmd on Mac) at the time of the keypress',
  shift: 'boolean — require Shift at the time of the keypress',
} as const;
