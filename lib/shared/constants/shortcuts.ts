/**
 * Centralised registry of editor keyboard shortcuts.
 *
 * Each entry in `SHORTCUTS` is the *definition* — what key/modifiers the user
 * presses plus the human label and category for documentation and future
 * settings UI. The runtime **handler** lives in the consumer (the editor
 * wires it up at registration time) so this file stays free of React state
 * and can be consumed by any caller, not just the editor.
 *
 * ## Why this exists
 *
 * Before this file, every shortcut was an inline `{ key: 'b', handler: ... }`
 * object literal inside `useKeyboardShortcuts([...])` in `EditorClient.tsx`
 * (and a second copy of the `'Escape'` binding in `StateMenu.tsx`). Changing
 * a key meant grepping the codebase; documenting shortcuts for a help panel
 * meant maintaining a parallel list; renaming a shortcut meant no
 * compile-time feedback if a consumer referenced it by mistake.
 *
 * Centralising here means:
 *   - Changing a binding is a single-line edit in `SHORTCUTS`.
 *   - `ShortcutId` (the keyof union) keeps consumers honest — misspelled
 *     ids fail at compile time.
 *   - The label + category are ready to feed a "keyboard shortcuts" overlay
 *     when we want one.
 *   - `bindShortcut(id, handler)` produces an object structurally compatible
 *     with the `Shortcut` type from `src/canvas/useKeyboardShortcuts` —
 *     no runtime indirection.
 *
 * Adding a new shortcut:
 *   1. Add a new entry to `SHORTCUTS` below (the `satisfies` clause ensures
 *      every entry has the right shape).
 *   2. Wire it in the consumer with `bindShortcut('yourId', () => ...)` or
 *      spread the entry for the dynamic 1..N subdivision case.
 */

/** The key + modifier combo the OS event must match. Mirrors the binding
 *  shape consumed by `useKeyboardShortcuts` (without the handler). */
export type ShortcutBinding = {
  /** Lowercase key or special name like "Escape", "ArrowUp". */
  key: string;
  /** Require Ctrl or Cmd. */
  ctrl?: boolean;
  /** Require Shift. */
  shift?: boolean;
};

/** Top-level grouping for shortcuts. Useful when surfacing a help overlay. */
export type ShortcutCategory = 'tool' | 'brush' | 'save' | 'navigation' | 'overlay';

/** A fully-bound shortcut: its binding plus human-facing metadata. */
export type ShortcutDef = ShortcutBinding & {
  /** Stable, code-level identifier. Use this in `bindShortcut`. */
  id: string;
  /** Human-readable label (Spanish) for help panels and tooltips. */
  label: string;
  category: ShortcutCategory;
};

/**
 * A shortcut **template** — like `ShortcutDef` but without the `key`. Use
 * for cases where the key is generated dynamically per instance (e.g. one
 * shortcut per subdivision with keys `'1'`, `'2'`, ...). The consumer
 * spreads the entry and supplies the `key`.
 */
export type ShortcutTemplate = Omit<ShortcutDef, 'key'>;

/**
 * The registry. Edit values here to re-bind any shortcut app-wide.
 *
 * Notes on specific entries:
 *   - `subdivisionTemplate` carries no `key` because the actual key is
 *     generated dynamically per subdivision (`'1'`, `'2'`, ...). Consumers
 *     spread the entry and override `key`.
 *   - `paintTool` and `toggleBrushShape` both target `'b'` — the second
 *     adds `shift: true`, so the OS distinguishes them via Shift state.
 */
export const SHORTCUTS = {
  paintTool: {
    id: 'paintTool',
    key: 'b',
    label: 'Pincel (pintar)',
    category: 'tool',
  },
  eraseTool: {
    id: 'eraseTool',
    key: 'e',
    label: 'Borrador',
    category: 'tool',
  },
  brushSizeDown: {
    id: 'brushSizeDown',
    key: '[',
    label: 'Reducir tamaño del pincel',
    category: 'brush',
  },
  brushSizeUp: {
    id: 'brushSizeUp',
    key: ']',
    label: 'Aumentar tamaño del pincel',
    category: 'brush',
  },
  toggleBrushShape: {
    id: 'toggleBrushShape',
    key: 'b',
    shift: true,
    label: 'Cambiar forma del pincel (circular ↔ cuadrada)',
    category: 'brush',
  },
  save: {
    id: 'save',
    key: 's',
    ctrl: true,
    label: 'Guardar manualmente',
    category: 'save',
  },
  closeOverlay: {
    id: 'closeOverlay',
    key: 'Escape',
    label: 'Cerrar menú o colapsar vista expandida',
    category: 'overlay',
  },
  floorUp: {
    id: 'floorUp',
    key: 'ArrowUp',
    shift: true,
    label: 'Subir de piso',
    category: 'navigation',
  },
  floorDown: {
    id: 'floorDown',
    key: 'ArrowDown',
    shift: true,
    label: 'Bajar de piso',
    category: 'navigation',
  },
  subdivisionTemplate: {
    // No `key` — the consumer assigns `String(i + 1)` per subdivision.
    id: 'subdivisionTemplate',
    label: 'Cambiar a subcapa N (1..9)',
    category: 'navigation',
  },
} as const satisfies Record<string, ShortcutDef | ShortcutTemplate>;

/** Union of all registered shortcut ids. Use as `bindShortcut` argument. */
export type ShortcutId = keyof typeof SHORTCUTS;

/**
 * Bind a registered shortcut to a runtime handler.
 *
 * Returns a plain object structurally compatible with the `Shortcut` type
 * consumed by `useKeyboardShortcuts` (key + optional ctrl/shift + handler).
 * `id`, `label`, and `category` are intentionally omitted from the return so
 * the result is assignable to `Shortcut[]` without coercion.
 *
 * @example
 *   useKeyboardShortcuts([
 *     bindShortcut('paintTool', () => setTool('paint')),
 *     bindShortcut('save', () => save(false)),
 *   ]);
 */
/**
 * Bind a registered shortcut to a runtime handler.
 *
 * Returns a plain object structurally compatible with the `Shortcut` type
 * consumed by `useKeyboardShortcuts` (key + optional ctrl/shift + handler).
 * `id`, `label`, and `category` are intentionally omitted from the return so
 * the result is assignable to `Shortcut[]` without coercion.
 *
 * Throws if `id` is the `subdivisionTemplate` (or any future template) —
 * those entries have no `key` of their own; the consumer is expected to
 * spread the entry and assign the key per instance.
 *
 * @example
 *   useKeyboardShortcuts([
 *     bindShortcut('paintTool', () => setTool('paint')),
 *     bindShortcut('save', () => save(false)),
 *   ]);
 */
export function bindShortcut(
  id: Exclude<ShortcutId, 'subdivisionTemplate'>,
  handler: () => void,
) {
  const def = SHORTCUTS[id] as ShortcutBinding;
  return {
    key: def.key,
    ...(def.ctrl !== undefined && { ctrl: def.ctrl }),
    ...(def.shift !== undefined && { shift: def.shift }),
    handler,
  };
}
