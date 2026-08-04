'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import {
  ROTATIONS,
  SPELL_TEMPLATES,
  templateSupportsRotation,
  type RotationDeg,
  type SpellTemplate,
  type SpellTemplateId,
} from '@/canvas/effects/spell-templates';
import styles from './spell-palette.module.css';

type Props = {
  /** Currently-selected spell template id, or `null` if none. */
  selectedId: SpellTemplateId | null;
  /** Currently-selected rotation in degrees (0/90/180/270). */
  rotation: RotationDeg;
  /** Called when the GM picks a template. */
  onSelect: (id: SpellTemplateId) => void;
  /** Called when the GM cycles the rotation (clockwise 90°). */
  onRotate: () => void;
};

/**
 * Spell picker for the GM's combat spellcasting tool. Mirrors the visual
 * language of `PiecePalette`: a vertical list of swatch cards plus a
 * title. Each card shows the template's colour (the marker colour the GM
 * will see on the canvas) and its label. The rotate button at the bottom
 * only appears when the selected template supports rotation (cones only).
 *
 * The picker does NOT know about combat gating or the `casterCombatantId`
 * — that's the parent's responsibility when it wires the click into the
 * ops buffer.
 */
export function SpellPalette({ selectedId, rotation, onSelect, onRotate }: Props) {
  const selectedTemplate = SPELL_TEMPLATES.find((t) => (t.id as string) === selectedId);
  const supportsRotation = selectedTemplate ? templateSupportsRotation(selectedTemplate) : false;

  return (
    <div className={styles.palette}>
      <h3 className={styles.paletteTitle}>Hechizos</h3>
      <div className={styles.paletteGrid}>
        {SPELL_TEMPLATES.map((template) => (
          <SpellCard
            key={template.id}
            template={template}
            active={template.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {supportsRotation ? (
        <div className={styles.rotationRow}>
          <span className={styles.rotationLabel} title="Rotación del hechizo (cono)">
            Rotación
          </span>
          <span className={styles.rotationValue} aria-live="polite">
            {rotation}°
          </span>
          <button
            type="button"
            className={styles.rotateButton}
            onClick={onRotate}
            title="Rotar 90° en sentido horario"
            aria-label="Rotar 90 grados"
          >
            <FontAwesomeIcon icon={faRotateLeft} /> Rotar
          </button>
        </div>
      ) : (
        <div className={styles.rotationHint}>
          {selectedTemplate ? (
            <span title="Los círculos no rotan">Rotación fija (círculo)</span>
          ) : (
            <span>Elegí un cono para rotarlo</span>
          )}
        </div>
      )}
    </div>
  );
}

type SpellCardProps = {
  template: SpellTemplate;
  active: boolean;
  onSelect: (id: SpellTemplateId) => void;
};

/** One spell in the picker. The card is a colour swatch + label. */
function SpellCard({ template, active, onSelect }: SpellCardProps) {
  return (
    <button
      type="button"
      className={`${styles.card} ${active ? styles.active : ''}`}
      onClick={() => onSelect(template.id as SpellTemplateId)}
      title={template.label}
      aria-label={template.label}
      aria-pressed={active}
    >
      <span
        className={styles.swatch}
        style={{ background: template.color }}
        aria-hidden="true"
      />
      <span className={styles.label}>{template.label}</span>
    </button>
  );
}

/** Cycle rotation clockwise by 90° (0 → 90 → 180 → 270 → 0). Exported so the
 *  caller (EditorClient) can use the same helper from a keyboard shortcut
 *  (PR 3 polish). */
export function rotateBy90(rotation: RotationDeg): RotationDeg {
  const idx = ROTATIONS.indexOf(rotation);
  return ROTATIONS[((idx + 1) % ROTATIONS.length + ROTATIONS.length) % ROTATIONS.length] ?? 0;
}
