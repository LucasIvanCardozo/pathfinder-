import type { Dispatch, SetStateAction } from 'react';
import {
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  normalizeBrushSize,
  type BrushShape,
  type Shortcut,
} from '@/canvas';
import {
  bindShortcut,
  KEYS_BY_CODE,
  SHORTCUTS,
  type ShortcutTemplate,
} from '@/lib/shared/constants';
import type { SubdivisionConfig } from '@/lib/shared/types';

type Args = {
  setTool: (t: import('@/canvas/tools').ToolKind) => void;
  setBrushSize: Dispatch<SetStateAction<number>>;
  setBrushShape: Dispatch<SetStateAction<BrushShape>>;
  setShowShortcuts: Dispatch<SetStateAction<boolean>>;
  /** Toggles the combat modal or its active-combat view. */
  toggleCombat: () => void;
  /** Combat turn operations are routed through the editor ops buffer. */
  nextTurn: () => void;
  previousTurn: () => void;
  advanceRound: () => void;
  /** Opens the combat modal in add-combatant mode. */
  addCombatant: () => void;
  /** PR 3: cycles the currently-selected spell template rotation 90° cw. */
  rotateSpell: () => void;
  /** Shared guard for modal-triggered shortcuts. */
  modalOpenRef?: { current: boolean };
  /** Wrapped save — the call site decides whether the autosave is currently
   *  in progress and short-circuits if so. */
  save: () => void;
  traitMenu: { close: () => void };
  setChromeVisible: Dispatch<SetStateAction<boolean>>;
  handleSubdivisionChange: (id: string) => void;
  subdivisions: readonly SubdivisionConfig[];
  handleFloorUp: () => void;
  handleFloorDown: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  handleUndo: () => void;
  handleRedo: () => void;
};

/** Subdivision entries are generated dynamically; this alias keeps the cast
 *  local to the map call rather than scattering casts across the file. */
type SubdivisionEntry = ShortcutTemplate & {
  code: string;
  handler: () => void;
};

/**
 * Builds the keyboard shortcut array for the editor. Lives outside the
 * component so the per-subdivision dynamic entries and the binding map stay
 * in one place. Consumers wrap the result with `useKeyboardShortcuts`.
 *
 * On Escape, the trait menu closes first (the menu is the first thing the
 * user backs out of when it's open) and then the shortcuts modal is also
 * closed, if open.
 */
export function buildEditorShortcuts(args: Args): Shortcut[] {
  return [
    bindShortcut('paintTool', () => args.setTool('paint')),
    bindShortcut('eraseTool', () => args.setTool('erase')),
    bindShortcut('brushSizeDown', () =>
      args.setBrushSize((s) => bumpBrushSizeDown(normalizeBrushSize(s))),
    ),
    bindShortcut('brushSizeUp', () =>
      args.setBrushSize((s) => bumpBrushSizeUp(normalizeBrushSize(s))),
    ),
    bindShortcut('toggleBrushShape', () =>
      args.setBrushShape((current) => (current === 'circle' ? 'square' : 'circle')),
    ),
    bindShortcut('toggleShortcutsModal', () => args.setShowShortcuts((v) => !v)),
    bindShortcut('toggleCombat', () => {
      if (args.modalOpenRef?.current) return;
      args.toggleCombat();
    }),
    bindShortcut('nextTurn', () => {
      if (args.modalOpenRef?.current) return;
      args.nextTurn();
    }),
    bindShortcut('previousTurn', () => {
      if (args.modalOpenRef?.current) return;
      args.previousTurn();
    }),
    bindShortcut('advanceRound', () => {
      if (args.modalOpenRef?.current) return;
      args.advanceRound();
    }),
    bindShortcut('addCombatant', () => {
      if (args.modalOpenRef?.current) return;
      args.addCombatant();
    }),
    bindShortcut('rotateSpell', () => {
      // No modal-guard: rotating never opens a modal. The handler is
      // a no-op when no template is selected (EditorClient guards).
      args.rotateSpell();
    }),
    bindShortcut('toggleChrome', () => args.setChromeVisible((v) => !v)),
    bindShortcut('save', () => args.save()),
    bindShortcut('closeOverlay', () => {
      args.traitMenu.close();
      args.setShowShortcuts(false);
    }),
    // Subdivision switches generated dynamically (one per subdivision, bound
    // to keys '1'..'9'). Spread the template entry and override key per item;
    // everything else (label, category) is shared. Non-paintable subdivisions
    // (e.g. darkness) are excluded so the user can't bind a digit to a layer
    // that isn't exposed in the tabs.
    ...args.subdivisions
      .filter((sub) => sub.paintable !== false)
      .map<SubdivisionEntry>((sub, i) => ({
        ...SHORTCUTS.subdivisionTemplate,
        code: KEYS_BY_CODE[`digit${i + 1}` as keyof typeof KEYS_BY_CODE],
        handler: () => args.handleSubdivisionChange(sub.id),
      })),
    bindShortcut('floorUp', args.handleFloorUp),
    bindShortcut('floorDown', args.handleFloorDown),
    bindShortcut('zoomIn', args.zoomIn),
    bindShortcut('zoomOut', args.zoomOut),
    bindShortcut('undo', args.handleUndo),
    bindShortcut('redo', args.handleRedo),
  ];
}
