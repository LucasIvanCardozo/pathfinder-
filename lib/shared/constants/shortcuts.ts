import { KEYS_BY_CODE } from './keyboard';

/**
 * Centralised registry of editor keyboard shortcuts.
 *
 * Each entry in `SHORTCUTS` is the *definition* — what key/modifiers the user
 * presses plus the human label and category for documentation and future
 * settings UI. The runtime **handler** lives in the consumer (the editor
 * wires it up at registration time) so this file stays free of React state
 * and can be consumed by any caller, not just the editor.
 *
 * ## Where the values come from
 *
 * - `code` values come from `KEYS_BY_CODE` in `./keyboard` (e.g.
 *   `KEYS_BY_CODE.keyB` = `'KeyB'`, `KEYS_BY_CODE.space` = `'Space'`).
 *   We prefer `code` over `key` because it's layout-independent: the same
 *   physical key returns the same `code` regardless of the OS keyboard
 *   layout (US, LATAM, UK, German, French, etc.).
 * - `ctrl` / `shift` are **booleans**, not strings — `ctrl: true` requires
 *   Ctrl (or Cmd on Mac). See `./keyboard`'s `MODIFIER_HELP` for details.
 *
 * Use the constants instead of string literals so the IDE can autocomplete
 * and a typo (`'Escap'`) becomes a compile error rather than a silent
 * dead binding.
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
 *  shape consumed by `useKeyboardShortcuts` (without the handler).
 *
 * `key` matches against `KeyboardEvent.key` (the character / virtual key
 * name like `'Escape'`, `'ArrowUp'`, `'b'`). `code` matches against
 * `KeyboardEvent.code` (the physical key identifier like `'Space'`,
 * `'Digit1'`). For most keys, either works; for the space bar you must
 * use `code: 'Space'` because `e.key` returns `' '` (a literal space
 * character) which is awkward to spell in source. */
export type ShortcutBinding = {
  /** Lowercase key or special name like "Escape", "ArrowUp". */
  key?: string;
  /** Physical key code like "Space", "Digit1". Required for non-character
   *  keys (Space, Tab) where `key` is ambiguous. */
  code?: string;
  /** Require Ctrl or Cmd. */
  ctrl?: boolean;
  /** Require Shift. */
  shift?: boolean;
};

/** Top-level grouping for shortcuts. Useful when surfacing a help overlay. */
export type ShortcutCategory = 'tool' | 'brush' | 'save' | 'navigation' | 'overlay' | 'edit';

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
    code: KEYS_BY_CODE.keyB,
    label: 'Pincel (pintar)',
    category: 'tool',
  },
  eraseTool: {
    id: 'eraseTool',
    code: KEYS_BY_CODE.keyE,
    label: 'Borrador',
    category: 'tool',
  },
  brushSizeDown: {
    id: 'brushSizeDown',
    code: KEYS_BY_CODE.bracketLeft,
    label: 'Reducir tamaño del pincel',
    category: 'brush',
  },
  brushSizeUp: {
    id: 'brushSizeUp',
    code: KEYS_BY_CODE.bracketRight,
    label: 'Aumentar tamaño del pincel',
    category: 'brush',
  },
  toggleBrushShape: {
    id: 'toggleBrushShape',
    code: KEYS_BY_CODE.keyB,
    shift: true,
    label: 'Cambiar forma del pincel (circular ↔ cuadrada)',
    category: 'brush',
  },
  toggleBrushPreview: {
    id: 'toggleBrushPreview',
    code: KEYS_BY_CODE.keyV,
    label: 'Mostrar / ocultar previsualización del pincel',
    category: 'brush',
  },
  toggleShortcutsModal: {
    id: 'toggleShortcutsModal',
    code: KEYS_BY_CODE.slash,
    label: 'Ver atajos de teclado',
    category: 'overlay',
  },
  save: {
    id: 'save',
    code: KEYS_BY_CODE.keyS,
    ctrl: true,
    label: 'Guardar manualmente',
    category: 'save',
  },
  undo: {
    id: 'undo',
    code: KEYS_BY_CODE.keyZ,
    ctrl: true,
    label: 'Deshacer',
    category: 'edit',
  },
  redo: {
    id: 'redo',
    code: KEYS_BY_CODE.keyZ,
    ctrl: true,
    shift: true,
    label: 'Rehacer',
    category: 'edit',
  },
  closeOverlay: {
    id: 'closeOverlay',
    code: KEYS_BY_CODE.escape,
    label: 'Cerrar menú o modal de atajos',
    category: 'overlay',
  },
  toggleChrome: {
    id: 'toggleChrome',
    code: KEYS_BY_CODE.keyH,
    label: 'Mostrar / ocultar paneles del editor',
    category: 'overlay',
  },
  /**
   * The space bar, used as a press-and-hold modifier for click-and-drag
   * panning. Tracked by `useStageViewport` via `keydown`/`keyup` listeners
   * (not via `useKeyboardShortcuts`, because the latter only fires on
   * press, not while the key is held). The entry here is the single
   * source of truth for *which* key acts as the pan modifier — re-bind
   * here to use a different key for panning.
   *
   * The Ctrl key (specifically the left Ctrl), used as a press-and-hold
   * modifier for click-and-drag panning. Tracked by `usePanModifier` via
   * `keydown`/`keyup` listeners (not via `useKeyboardShortcuts`, because the
   * latter only fires on press, not while the key is held). The entry here
   * is the single source of truth for *which* key acts as the pan modifier.
   */
  panModifier: {
    id: 'panModifier',
    code: KEYS_BY_CODE.controlLeft,
    label: 'Ctrl + click+drag = mover el mapa',
    category: 'navigation',
  },
  floorUp: {
    id: 'floorUp',
    code: KEYS_BY_CODE.arrowUp,
    shift: true,
    label: 'Subir de piso',
    category: 'navigation',
  },
  floorDown: {
    id: 'floorDown',
    code: KEYS_BY_CODE.arrowDown,
    shift: true,
    label: 'Bajar de piso',
    category: 'navigation',
  },
  /**
   * Zoom in / out. Bound to `=` and `-` (no modifier) — matches the Figma /
   * Photoshop convention and keeps the binding single-key so a typo can't
   * require both `Ctrl` and Shift (which is what `+` would need). If you
   * want the Ctrl/Cmd-prefixed convention (VSCode, browsers), change these
   * to `key: KEYS.equals, ctrl: true` and `key: KEYS.minus, ctrl: true`.
   */
  zoomIn: {
    id: 'zoomIn',
    code: KEYS_BY_CODE.equal,
    label: 'Aumentar zoom',
    category: 'navigation',
  },
  zoomOut: {
    id: 'zoomOut',
    code: KEYS_BY_CODE.minus,
    label: 'Reducir zoom',
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
    // Prefer `code` (layout-independent physical key); fall back to `key`
    // (character-based) for any legacy shortcut that still uses it. The
    // matching loop in `useKeyboardShortcuts` tries both.
    ...(def.code !== undefined && { code: def.code }),
    ...(def.key !== undefined && { key: def.key }),
    ...(def.ctrl !== undefined && { ctrl: def.ctrl }),
    ...(def.shift !== undefined && { shift: def.shift }),
    handler,
  };
}

/**
 * Flat list of every shortcut the editor exposes, in registry order, with the
 * `subdivisionTemplate` (no `key` of its own) filtered out so consumers can
 * iterate without special-casing. Use this to drive the "keyboard shortcuts"
 * help modal — keeps the registry as the single source of truth.
 */
export function listShortcuts(): ShortcutDef[] {
  return (Object.values(SHORTCUTS) as Array<ShortcutDef | ShortcutTemplate>).filter(
    (def): def is ShortcutDef => 'key' in def || 'code' in def,
  );
}
