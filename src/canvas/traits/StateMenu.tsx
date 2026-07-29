'use client';

import { useEffect } from 'react';
import styles from './state-menu.module.css';

type StateMenuProps = {
  /** All valid state values for this trait. */
  states: readonly string[];
  /** Human-readable label per state. */
  labels: Record<string, string>;
  /** Current state. */
  current: string | undefined;
  /** Called when the user picks a new state. */
  onChange: (newState: string) => void;
  /** Called when the menu should close (click outside, Esc, X button). */
  onClose: () => void;
  /** Title shown in the menu header (e.g. "Puerta"). */
  title: string;
  /** Optional className for the root element. */
  className?: string;
};

/**
 * Generic state-picker menu. Any trait with a finite set of states can use
 * this component via `getMenu` in the trait registry.
 *
 * The root div carries a `data-state-menu` attribute (not just a CSS class)
 * so the outside-click handler can identify it via `closest("[data-state-menu]")`.
 * The selector-based class name no longer leaks through CSS Modules' scoped
 * hashing, so the data-attribute pattern keeps the click-outside test stable.
 */
export function StateMenu({
  states,
  labels,
  current,
  onChange,
  onClose,
  title,
  className,
}: StateMenuProps) {
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('[data-state-menu]')) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const menuClass = className ? `${styles.menu} ${className}` : styles.menu;
  return (
    <div className={menuClass} data-state-menu>
      <div className={styles.header}>
        <span>
          {title} · {labels[current ?? states[0] ?? ''] ?? current}
        </span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar menú">
          ×
        </button>
      </div>
      <div className={styles.section}>
        <span className={styles.label}>Cambiar estado</span>
        <div className={styles.states}>
          {states.map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.stateBtn} ${s === current ? styles.active : ''}`}
              onClick={() => onChange(s)}
              data-state={s}
            >
              {labels[s] ?? s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
