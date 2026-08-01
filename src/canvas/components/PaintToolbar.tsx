'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEraser, faPaintbrush } from '@fortawesome/free-solid-svg-icons';
import React from 'react';
import { BRUSH_SHAPES } from '@/lib/shared/constants';
import type { BrushShape } from '../tools';
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
  /**
   * Geometric shape of the brush footprint. Toggleable from the toolbar; the
   * parent owns the value so the choice survives tool changes and (until
   * persisted, which is intentionally not today) reloads.
   */
  brushShape: BrushShape;
  onBrushShapeChange: (shape: BrushShape) => void;
};

// Shape iconography: circle uses a single-character glyph; square uses a small
// rectangle made from box-drawing characters so the visual matches the geometric
// footprint the brush will actually stamp.
const SHAPE_GLYPHS: Record<BrushShape, string> = {
  circle: '○',
  square: '⬜',
};

const SHAPE_LABELS: Record<BrushShape, string> = {
  circle: 'Circular',
  square: 'Cuadrada',
};

/**
 * Tool selector + brush size controls. The brush size is shown as a live
 * "NxN" footprint hint so the user sees the exact circle diameter they will
 * paint with. The preview indicator itself lives on the canvas (FloorCanvas);
 * this component only exposes the controls.
 */
export function PaintToolbar({
  tool,
  onChange,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
}: Props) {
  const size = normalizeBrushSize(brushSize);

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <button
          type="button"
          className={`${styles.tool} ${tool === 'paint' ? styles.active : ''}`}
          onClick={() => onChange('paint')}
          title="Pintar (click + drag)"
          aria-label="Pintar"
          aria-pressed={tool === 'paint'}
        >
          <FontAwesomeIcon icon={faPaintbrush} />
        </button>
        <button
          type="button"
          className={`${styles.tool} ${tool === 'erase' ? styles.active : ''}`}
          onClick={() => onChange('erase')}
          title="Borrar (click + drag)"
          aria-label="Borrar"
          aria-pressed={tool === 'erase'}
        >
          <FontAwesomeIcon icon={faEraser} />
        </button>
      </div>

      <div className={styles.brushSection}>
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
          <span className={styles.brushValue} title="Tamaño en celdas de la subcapa activa">
            {size}×{size}
          </span>
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

      {/* Brush-shape segmented control. Mirrors the pattern of the tool
          selector above — two buttons in a flex row with an `active` state on
          the selected one. Source of truth for the shape options is
          `BRUSH_SHAPES` so a new shape only needs to extend that array (plus
          the SHAPE_GLYPHS / SHAPE_LABELS maps and the CSS rules). */}
      <fieldset className={styles.brushSection}>
        <legend className={styles.brushLabel}>Forma</legend>
        <div className={styles.shapeGroup}>
          {BRUSH_SHAPES.map((shape) => {
            const inputId = `brush-shape-${shape}`;
            return (
              <React.Fragment key={shape}>
                <input
                  id={inputId}
                  type="radio"
                  name="brush-shape"
                  value={shape}
                  checked={brushShape === shape}
                  onChange={() => onBrushShapeChange(shape)}
                  className={styles.shapeInput}
                />
                <label
                  htmlFor={inputId}
                  className={`${styles.shape} ${brushShape === shape ? styles.shapeActive : ''}`}
                  title={`Pincel ${SHAPE_LABELS[shape].toLowerCase()}`}
                  aria-label={`Pincel ${SHAPE_LABELS[shape].toLowerCase()}`}
                >
                  <span aria-hidden="true" className={styles.shapeGlyph}>
                    {SHAPE_GLYPHS[shape]}
                  </span>
                </label>
              </React.Fragment>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
