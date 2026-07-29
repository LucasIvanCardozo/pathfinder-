'use client';

import styles from './paint-toolbar.module.css';

export type PaintTool = 'paint' | 'erase';

type Props = {
  tool: PaintTool;
  onChange: (tool: PaintTool) => void;
};

export function PaintToolbar({ tool, onChange }: Props) {
  return (
    <div className={styles.toolbar}>
      <button
        type="button"
        className={`${styles.tool} ${tool === 'paint' ? styles.active : ''}`}
        onClick={() => onChange('paint')}
        title="Pintar (click + drag)"
      >
        🖌 Pintar
      </button>
      <button
        type="button"
        className={`${styles.tool} ${tool === 'erase' ? styles.active : ''}`}
        onClick={() => onChange('erase')}
        title="Borrar (click + drag)"
      >
        🧹 Borrar
      </button>
    </div>
  );
}
