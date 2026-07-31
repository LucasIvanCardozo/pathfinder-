import type { Dispatch, SetStateAction } from 'react';
import {
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  normalizeBrushSize,
  type BrushShape,
  type PaintTool,
  type Shortcut,
} from '@/canvas';
import { bindShortcut, SHORTCUTS, type ShortcutTemplate } from '@/lib/shared/constants';
import type { SubdivisionConfig } from '@/lib/shared/types';

type Args = {
  setTool: (t: PaintTool) => void;
  setBrushSize: Dispatch<SetStateAction<number>>;
  setBrushShape: Dispatch<SetStateAction<BrushShape>>;
  /** Wrapped save — the call site decides whether the autosave is currently
   *  in progress and short-circuits if so. */
  save: () => void;
  traitMenu: { close: () => void };
  setIsCanvasExpanded: Dispatch<SetStateAction<boolean>>;
  handleSubdivisionChange: (id: string) => void;
  subdivisions: readonly SubdivisionConfig[];
  handleFloorUp: () => void;
  handleFloorDown: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

/** Subdivision entries are generated dynamically; this alias keeps the cast
 *  local to the map call rather than scattering casts across the file. */
type SubdivisionEntry = ShortcutTemplate & {
  key: string;
  handler: () => void;
};

/**
 * Builds the keyboard shortcut array for the editor. Lives outside the
 * component so the per-subdivision dynamic entries and the binding map stay
 * in one place. Consumers wrap the result with `useKeyboardShortcuts`.
 *
 * Trait-menu `close` runs before the canvas-collapse toggle on Escape so the
 * menu is the first thing the user backs out of when it's open.
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
    bindShortcut('save', () => args.save()),
    bindShortcut('closeOverlay', () => {
      args.traitMenu.close();
      args.setIsCanvasExpanded(false);
    }),
    // Subdivision switches generated dynamically (one per subdivision, bound
    // to keys '1'..'9'). Spread the template entry and override key per item;
    // everything else (label, category) is shared.
    ...args.subdivisions.map<SubdivisionEntry>((sub, i) => ({
      ...SHORTCUTS.subdivisionTemplate,
      key: String(i + 1),
      handler: () => args.handleSubdivisionChange(sub.id),
    })),
    bindShortcut('floorUp', args.handleFloorUp),
    bindShortcut('floorDown', args.handleFloorDown),
    bindShortcut('zoomIn', args.zoomIn),
    bindShortcut('zoomOut', args.zoomOut),
  ];
}
