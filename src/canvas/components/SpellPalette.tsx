'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateRight } from '@fortawesome/free-solid-svg-icons';

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
  /** Current duration in world rounds (1-99). PF1e-style lifetime. */
  durationRounds: number;
  /** Called with a clamped 1-99 value when the GM commits the duration. */
  onDurationChange: (n: number) => void;
};

// PF1e practical cap. The server's Zod schema still allows up to 99
// rounds (so legacy rows with long durations survive a read), but the
// GM only ever picks 1-10 from the SpellPalette — long-duration spells
// are rare and the dropdown keeps the UI honest. The clamp helper
// remains as a safety net for any code path that hand-rolls a value.
const DURATION_CHOICES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MIN_ROUNDS = DURATION_CHOICES[0] ?? 1;
const MAX_ROUNDS = DURATION_CHOICES[DURATION_CHOICES.length - 1] ?? 10;

function clampRounds(n: number): number {
  if (Number.isNaN(n)) return MIN_ROUNDS;
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.trunc(n)));
}

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
export function SpellPalette({
  selectedId,
  rotation,
  onSelect,
  onRotate,
  durationRounds,
  onDurationChange,
}: Props) {
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
      {selectedTemplate ? (
        <div className={styles.durationRow}>
          <label
            className={styles.durationLabel}
            htmlFor="spell-duration-rounds"
            title="Duración en rondas del mundo (PF1e)"
          >
            Rondas
          </label>
          <select
            id="spell-duration-rounds"
            className={styles.durationInput}
            value={durationRounds}
            onChange={(e) => onDurationChange(clampRounds(Number(e.target.value)))}
            aria-label="Duración en rondas del hechizo"
          >
            {Array.from(
              new Set([
                ...DURATION_CHOICES,
                ...(durationRounds >= MIN_ROUNDS && durationRounds <= MAX_ROUNDS
                  ? []
                  : [clampRounds(durationRounds)]),
              ]),
            )
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
        </div>
      ) : null}
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
            <FontAwesomeIcon icon={faRotateRight} /> Rotar
          </button>
        </div>
      ) : selectedTemplate ? (
        <div className={styles.rotationHint}>
          <span title="Los círculos no rotan">Rotación fija (círculo)</span>
        </div>
      ) : (
        <div className={styles.rotationHint}>
          <span>Elegí un hechizo para configurar la duración</span>
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
  // Cycle 0 → 90 → 180 → 270 → 0. Single modulo is enough because ROTATIONS is
  // a fixed 4-tuple and the caller never feeds a negative index.
  const idx = ROTATIONS.indexOf(rotation);
  return ROTATIONS[(idx + 1) % ROTATIONS.length] ?? 0;
}
