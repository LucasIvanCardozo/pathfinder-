'use client';

import { useState } from 'react';
import type { SubdivisionConfig } from '@/lib/shared/types';
import styles from './subdivision-tabs.module.css';

type Props = {
  subdivisions: SubdivisionConfig[];
  activeId: string;
  onChange: (id: string) => void;
  /**
   * Called when the user drops a tab on another tab. `fromId` is the tab
   * being dragged; `toId` is the tab it was dropped on; `side` is which
   * half of the target the cursor was over ("left" or "right").
   */
  onReorder: (fromId: string, toId: string, side: 'left' | 'right') => void;
};

type DropIndicator = { id: string; side: 'left' | 'right' } | null;

/**
 * Subdivision tab strip. Every subdivision (including ones that contain
 * door textures) is rendered as a peer tab — the old "Puertas" special tab
 * is gone, replaced by the trait system.
 */
export function SubdivisionTabs({ subdivisions, activeId, onChange, onReorder }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right';
    setDropIndicator({ id, side });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropIndicator(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData('text/plain');
    if (!fromId || !dropIndicator || fromId === dropIndicator.id) {
      handleDragEnd();
      return;
    }
    onReorder(fromId, dropIndicator.id, dropIndicator.side);
    handleDragEnd();
  };

  return (
    <div className={styles.tabs} role="tablist">
      {subdivisions.map((sub) => {
        const isDragging = draggingId === sub.id;
        const indicatorHere =
          dropIndicator && dropIndicator.id === sub.id ? dropIndicator.side : null;
        const wrapperClass = indicatorHere
          ? `${styles.tabWrapper} ${indicatorHere === 'left' ? styles.dropLeft : styles.dropRight}`
          : styles.tabWrapper;
        const tabClass = `${styles.tab} ${sub.id === activeId ? styles.active : ''} ${isDragging ? styles.dragging : ''}`;
        return (
          <div key={sub.id} className={wrapperClass}>
            <button
              type="button"
              role="tab"
              aria-selected={sub.id === activeId}
              draggable
              className={tabClass}
              onClick={() => onChange(sub.id)}
              onDragStart={(e) => handleDragStart(e, sub.id)}
              onDragOver={(e) => handleDragOver(e, sub.id)}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            >
              {sub.name}
            </button>
          </div>
        );
      })}
    </div>
  );
}
