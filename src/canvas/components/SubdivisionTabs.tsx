'use client';

import type { SubdivisionConfig } from '@/lib/shared/types';
import styles from './subdivision-tabs.module.css';

type Props = {
  subdivisions: readonly SubdivisionConfig[];
  activeId: string;
  onChange: (id: string) => void;
};

/**
 * Subdivision tab strip. Every subdivision (including ones that contain
 * door textures) is rendered as a peer tab — the old "Puertas" special tab
 * is gone, replaced by the trait system.
 *
 * Subdivisions are immutable since the move to hardcoded configs, so the
 * drag-and-drop reorder handler was removed. Tabs are read-only.
 */
export function SubdivisionTabs({ subdivisions, activeId, onChange }: Props) {
  return (
    <div className={styles.tabs} role="tablist">
      {subdivisions
        .filter((sub) => sub.paintable !== false)
        .map((sub) => {
          const tabClass = `${styles.tab} ${sub.id === activeId ? styles.active : ''}`;
          return (
            <div key={sub.id} className={styles.tabWrapper}>
              <button
                type="button"
                role="tab"
                aria-selected={sub.id === activeId}
                className={tabClass}
                onClick={() => onChange(sub.id)}
              >
                {sub.name}
              </button>
            </div>
          );
        })}
    </div>
  );
}
