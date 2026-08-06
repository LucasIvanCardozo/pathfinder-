'use client';

import {
  SPELL_TEMPLATES,
  type SpellTemplate,
  type SpellTemplateId,
} from '@/canvas/effects/spell-templates';
import styles from './spell-palette.module.css';

type Props = {
  /** Currently-selected spell template id, or `null` if none. */
  selectedId: SpellTemplateId | null;
  /** Called when the GM picks a template. */
  onSelect: (id: SpellTemplateId) => void;
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
 * will see on the canvas) and its label.
 *
 * Rotation does not live here — the GM cycles the rotation state via
 * right-click on the canvas (or the `Q` shortcut). The SpellPalette stays
 * focused on template selection + PF1e-style duration in world rounds.
 *
 * The picker does NOT know about combat gating or the `casterCombatantId`
 * — that's the parent's responsibility when it wires the click into the
 * ops buffer.
 */
export function SpellPalette({ selectedId, onSelect, durationRounds, onDurationChange }: Props) {
  const selectedTemplate = SPELL_TEMPLATES.find((t) => (t.id as string) === selectedId);

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
      <span className={styles.swatch} style={{ background: template.color }} aria-hidden="true" />
      <span className={styles.label}>{template.label}</span>
    </button>
  );
}

// Re-export `cycleRotationIndex` so `EditorClient` (and any future caller)
// has a single import path for the rotation helper. The helper itself lives
// in `spell-templates.ts` next to the rotation type definition.
export { cycleRotationIndex } from '@/canvas/effects/spell-templates';
