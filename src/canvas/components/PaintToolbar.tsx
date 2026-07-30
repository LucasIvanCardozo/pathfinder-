'use client';

import { useId } from 'react';
import {
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  normalizeBrushSize,
} from '../tools';
import styles from './paint-toolbar.module.css';

export type PaintTool = 'paint' | 'erase';

type Props = {
  tool: PaintTool;
  onChange: (tool: PaintTool) => void;
  /**
   * Brush footprint size in active-subdivision cells. Must be odd. The parent
   * owns the value so the brush size survives tool toggles and reloads.
   */
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
};

/**
 * Tool selector + brush size controls. Brush size is shown as both a numeric
 * value (the slider) and a live "NxN" footprint hint, so the user can see the
 * exact circle diameter they will paint with. The preview indicator itself
 * lives on the canvas (FloorCanvas); this component only exposes the
 * controls.
 */
export function PaintToolbar({ tool, onChange, brushSize, onBrushSizeChange }: Props) {
  const size = normalizeBrushSize(brushSize);
  const sliderId = useId();

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number.parseInt(e.target.value, 10);
    if (Number.isFinite(next)) onBrushSizeChange(normalizeBrushSize(next));
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <button
          type="button"
          className={`${styles.tool} ${tool === 'paint' ? styles.active : ''}`}
          onClick={() => onChange('paint')}
          title="Pintar (click + drag)"
          aria-pressed={tool === 'paint'}
        >
          🖌 Pintar
        </button>
        <button
          type="button"
          className={`${styles.tool} ${tool === 'erase' ? styles.active : ''}`}
          onClick={() => onChange('erase')}
          title="Borrar (click + drag)"
          aria-pressed={tool === 'erase'}
        >
          🧹 Borrar
        </button>
      </div>

      <div className={styles.brushSection}>
        <div className={styles.brushHeader}>
          <label htmlFor={sliderId} className={styles.brushLabel}>
            Pincel
          </label>
          <span className={styles.brushValue} title="Tamaño en celdas de la subcapa activa">
            {size}×{size}
          </span>
        </div>
        <div className={styles.brushControls}>
          <button
            type="button"
            className={styles.brushStep}
            onClick={() => onBrushSizeChange(bumpBrushSizeDown(size))}
            disabled={size <= MIN_BRUSH_SIZE}
            title="Reducir pincel"
            aria-label="Reducir pincel"
          >
            −
          </button>
          <input
            id={sliderId}
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            step={2}
            value={size}
            onChange={handleSliderChange}
            className={styles.brushSlider}
            title={`Tamaño del pincel: ${size}×${size} celdas`}
            aria-label="Tamaño del pincel"
          />
          <button
            type="button"
            className={styles.brushStep}
            onClick={() => onBrushSizeChange(bumpBrushSizeUp(size))}
            disabled={size >= MAX_BRUSH_SIZE}
            title="Aumentar pincel"
            aria-label="Aumentar pincel"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
