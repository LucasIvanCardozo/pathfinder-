'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRotateBackward,
  faCompass,
  faFloppyDisk,
  faPaintbrush,
  faToolbox,
  faWindowMaximize,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { listShortcuts, type ShortcutCategory, type ShortcutDef } from '@/lib/shared/constants';
import { Modal } from './Modal';
import styles from './shortcuts-modal.module.css';

const CATEGORY_META: Record<ShortcutCategory, { label: string; icon: IconDefinition }> = {
  tool: { label: 'Herramienta', icon: faToolbox },
  brush: { label: 'Pincel', icon: faPaintbrush },
  save: { label: 'Guardar', icon: faFloppyDisk },
  navigation: { label: 'Navegación', icon: faCompass },
  overlay: { label: 'Overlay', icon: faWindowMaximize },
  edit: { label: 'Edición', icon: faArrowRotateBackward },
};

const CATEGORY_ORDER: ShortcutCategory[] = [
  'tool',
  'brush',
  'save',
  'edit',
  'navigation',
  'overlay',
];

/**
 * Map of `KeyboardEvent.code` values to friendly labels for the modal. Codes
 * are layout-independent physical key identifiers (see `useKeyboardShortcuts`
 * for why we use `code` over `key`), so the label here is just a UI nicety.
 */
/**
 * Display labels for `KeyboardEvent.code` values. We show the character the
 * key *typically produces* on US/LATAM (the most common layouts for this app's
 * users) rather than the raw `code` identifier. The binding itself is by
 * `code`, so the shortcut still fires when the same physical key produces a
 * different character on another layout.
 */
const CODE_LABELS: Record<string, string> = {
  KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F',
  KeyG: 'G', KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L',
  KeyM: 'M', KeyN: 'N', KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R',
  KeyS: 'S', KeyT: 'T', KeyU: 'U', KeyV: 'V', KeyW: 'W', KeyX: 'X',
  KeyY: 'Y', KeyZ: 'Z',
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  BracketLeft: '[',
  BracketRight: ']',
  Equal: '=',
  Minus: '-',
  /**
   * Slash shows as `?` because the toggle-shortcuts-modal shortcut is bound
   * to the physical Slash key, which produces `?` with Shift on US/LATAM.
   * On layouts where `?` is on a different physical key, this binding won't
   * fire — see AGENTS.md for the list of supported layouts.
   */
  Slash: '?',
  Backslash: '\\',
  Space: 'Space',
  Escape: 'Esc',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/**
 * Format a binding for display. Reads `code` (layout-independent) and falls
 * back to `key` for any shortcut that still uses it. Shift/Ctrl prefixes go
 * first; the key code goes last.
 */
function formatBinding(def: ShortcutDef): string[] {
  const parts: string[] = [];
  if (def.ctrl) parts.push('Ctrl');
  if (def.shift) parts.push('⇧');
  if (def.code) parts.push(CODE_LABELS[def.code] ?? def.code);
  else if (def.key) {
    parts.push(def.key === ' ' ? 'Space' : prettifyKey(def.key));
  }
  return parts;
}

function prettifyKey(key: string): string {
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Help modal listing every registered shortcut grouped by category. Single
 * source of truth: the `SHORTCUTS` registry in `lib/shared/constants/shortcuts.ts`.
 */
export function ShortcutsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const grouped = new Map<ShortcutCategory, ShortcutDef[]>();
  for (const def of listShortcuts()) {
    const bucket = grouped.get(def.category) ?? [];
    bucket.push(def);
    grouped.set(def.category, bucket);
  }

  return (
    <Modal isOpen={isOpen} title="⌨ Atajos de teclado" onClose={onClose}>
      <div className={styles.shortcuts}>
        {CATEGORY_ORDER.map((cat) => {
          const defs = grouped.get(cat);
          if (!defs || defs.length === 0) return null;
          const meta = CATEGORY_META[cat];
          return (
            <section key={cat} className={styles.category}>
              <h3 className={styles.categoryTitle}>
                <FontAwesomeIcon icon={meta.icon} className={styles.categoryIcon} />
                {meta.label}
              </h3>
              <dl className={styles.list}>
                {defs.map((def) => {
                  const keys = formatBinding(def);
                  return (
                    <div key={def.id} className={styles.row}>
                      <dt className={styles.keys}>
                        {keys.map((k, i) => (
                          <span key={`${def.id}-${k}`} className={styles.keyGroup}>
                            {i > 0 && <span className={styles.plus}>+</span>}
                            <kbd className={styles.kbd}>{k}</kbd>
                          </span>
                        ))}
                      </dt>
                      <dd className={styles.label}>{def.label}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}