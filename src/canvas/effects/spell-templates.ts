/**
 * Hardcoded spell templates for the GM's combat spellcasting tool.
 *
 * Single source of truth for spell shapes. The renderer, the picker UI, and
 * the persisted `ScenarioEffect.templateId` all read from `SPELL_TEMPLATES`
 * — adding a new spell is a one-line edit here plus (if the shape is new)
 * a corresponding walker in `footprint.ts`.
 *
 * Units:
 *   - `sizeFt` is forward length for cones, radius for circles.
 *     1 base cell = 5 ft (`FEET_PER_BASE_CELL`).
 *   - Cones rotate in 90° steps (0/90/180/270). Circles ignore rotation.
 *   - `defaultRotationDeg` is the rotation the template opens with in the UI;
 *     the GM can cycle it with the rotate button (cones only).
 *
 * Why hardcoded: the catalog is the union of the standard D&D/Pathfinder AoE
 * templates. A user-editable catalog is out of scope — the GM picks from the
 * seven hardcoded shapes and casts; the schema stays a closed enum of ids.
 */

export type SpellShape = 'cone' | 'circle';

export type SpellTemplate = {
  /** Stable id persisted on `ScenarioEffect.templateId`. */
  id: string;
  /** Human label for the picker UI. Spanish, in the same voice as the rest. */
  label: string;
  shape: SpellShape;
  /** Forward length for cones, radius for circles. Always in feet. */
  sizeFt: number;
  /** Hex colour rendered into the marker. */
  color: string;
  /**
   * Rotation the picker opens with. The GM cycles it with the rotate button
   * in 90° steps. Circles ignore this field at render time.
   */
  defaultRotationDeg: RotationDeg;
};

export const ROTATIONS = [0, 90, 180, 270] as const;
export type RotationDeg = (typeof ROTATIONS)[number];

/**
 * Seven hardcoded templates — four cones (two sizes × two starting directions)
 * and three circles. The two "starting directions" for cones are just different
 * default rotations; the rotate button can move any cone to any of the four
 * cardinal positions.
 */
export const SPELL_TEMPLATES = [
  { id: 'cone-15-ne', label: 'Cono 15 pies (NE)', shape: 'cone', sizeFt: 15, color: '#e74c3c', defaultRotationDeg: 0 },
  { id: 'cone-15-sw', label: 'Cono 15 pies (SW)', shape: 'cone', sizeFt: 15, color: '#e74c3c', defaultRotationDeg: 180 },
  { id: 'cone-30-ne', label: 'Cono 30 pies (NE)', shape: 'cone', sizeFt: 30, color: '#e67e22', defaultRotationDeg: 0 },
  { id: 'cone-30-sw', label: 'Cono 30 pies (SW)', shape: 'cone', sizeFt: 30, color: '#e67e22', defaultRotationDeg: 180 },
  { id: 'radius-5', label: 'Radio 5 pies', shape: 'circle', sizeFt: 5, color: '#3498db', defaultRotationDeg: 0 },
  { id: 'radius-10', label: 'Radio 10 pies', shape: 'circle', sizeFt: 10, color: '#2ecc71', defaultRotationDeg: 0 },
  { id: 'radius-20', label: 'Radio 20 pies', shape: 'circle', sizeFt: 20, color: '#9b59b6', defaultRotationDeg: 0 },
] as const satisfies readonly SpellTemplate[];

/** Convenience union of the seven template ids — the closed enum on the schema. */
export type SpellTemplateId = (typeof SPELL_TEMPLATES)[number]['id'];

/**
 * Resolve a template by id. Falls back to the first template if the id is
 * unknown (defensive — the closed enum should prevent this in practice).
 */
export function templateById(id: string): SpellTemplate {
  return SPELL_TEMPLATES.find((t) => t.id === id) ?? SPELL_TEMPLATES[0];
}

/** True if the template supports rotation (cones do, circles do not). */
export function templateSupportsRotation(template: SpellTemplate): boolean {
  return template.shape === 'cone';
}
