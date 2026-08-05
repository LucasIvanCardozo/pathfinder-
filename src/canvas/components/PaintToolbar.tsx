'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircle,
  faEraser,
  faHatWizard,
  faMoon,
  faPaintbrush,
  faSquareFull,
  faSun,
} from '@fortawesome/free-solid-svg-icons';
import React from 'react';
import { BRUSH_SHAPES } from '@/lib/shared/constants';
import type { BrushShape, ToolKind } from '../tools';
import {
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  normalizeBrushSize,
} from '../tools';
import styles from './paint-toolbar.module.css';

type Props = {
  tool: ToolKind;
  darknessMode: 'apply' | 'erase';
  onChange: (tool: ToolKind) => void;
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
  /**
   * When `false`, the effects tool button shows a "Iniciá un combate"
   * toast on click and the aside shows a permanent banner. The button
   * stays enabled so the GM can still pick the tool and read the banner.
   */
  combatActive: boolean;
};

// Shape iconography: the icon picks come from FontAwesome so the toolbar stays
// consistent with the rest of the editor (no Unicode glyph soup). `faCircle`
// reads as the open circle; `faSquareFull` reads as a solid square brush
// footprint — matches the geometric stamp the user will actually paint.
const SHAPE_ICONS: Record<BrushShape, typeof faCircle> = {
  circle: faCircle,
  square: faSquareFull,
};

const SHAPE_LABELS: Record<BrushShape, string> = {
  circle: 'Circular',
  square: 'Cuadrada',
};

/**
 * Tool selector + brush size + brush shape controls. The brush size is shown
 * as a live "NxN" footprint hint so the user sees the exact circle diameter
 * they will paint with. The preview indicator itself lives on the canvas
 * (FloorCanvas); this component only exposes the controls.
 *
 * The brush size + shape sections are hidden when `tool === 'effects'`: the
 * spell template owns its own shape and size (see `SPELL_TEMPLATES`).
 */
export function PaintToolbar({
  tool,
  darknessMode,
  onChange,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
  combatActive,
}: Props) {
  const size = normalizeBrushSize(brushSize);
  const showPaintBrushControls = tool !== 'effects';

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
        <button
          type="button"
          className={`${styles.tool} ${tool === 'darkness' ? styles.active : ''}`}
          onClick={() => onChange('darkness')}
          title={
            tool === 'darkness'
              ? darknessMode === 'apply'
                ? 'Oscuridad: aplicar (click = pintar, click de nuevo = borrar)'
                : 'Oscuridad: borrar (click = quitar, click de nuevo = aplicar)'
              : 'Oscuridad (click = aplicar, click de nuevo = borrar)'
          }
          aria-label={
            tool === 'darkness'
              ? darknessMode === 'apply'
                ? 'Oscuridad aplicar'
                : 'Oscuridad borrar'
              : 'Oscuridad'
          }
          aria-pressed={tool === 'darkness'}
          data-mode={tool === 'darkness' ? darknessMode : undefined}
        >
          <FontAwesomeIcon
            icon={tool === 'darkness' && darknessMode === 'erase' ? faSun : faMoon}
          />
        </button>
        <button
          type="button"
          className={`${styles.tool} ${tool === 'effects' ? styles.active : ''}`}
          onClick={() => onChange('effects')}
          title={
            combatActive
              ? 'Hechizos (Q para rotar) — elegir template y colocar en el canvas'
              : 'Iniciá un combate para usar hechizos'
          }
          aria-label="Hechizos"
          aria-pressed={tool === 'effects'}
        >
          <FontAwesomeIcon icon={faHatWizard} />
        </button>
      </div>

      {showPaintBrushControls && (
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
      )}

      {/* Brush-shape segmented control. Mirrors the pattern of the tool
          selector above — two buttons in a flex row with an `active` state on
          the selected one. Source of truth for the shape options is
          `BRUSH_SHAPES` so a new shape only needs to extend that array (plus
          the SHAPE_ICONS / SHAPE_LABELS maps and the CSS rules). Hidden in
          the effects tool (the spell template owns its own shape + size). */}
      {showPaintBrushControls && (
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
                    <FontAwesomeIcon
                      aria-hidden="true"
                      className={styles.shapeGlyph}
                      icon={SHAPE_ICONS[shape]}
                    />
                  </label>
                </React.Fragment>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
