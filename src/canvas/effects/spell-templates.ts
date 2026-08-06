/**
 * Hardcoded spell templates for the GM's combat spellcasting tool.
 *
 * Single source of truth for spell shapes. The renderer, the picker UI, and
 * the persisted `ScenarioEffect.templateId` all read from `SPELL_TEMPLATES`
 * — adding a new spell is a one-line edit here plus the matrix literal that
 * defines its shape.
 *
 * Each template declares a list of `figures` (visual variants). The
 * rotation cycle **interleaves** them by parity and steps by stride:
 * `figureIdx = rotationIndex % figures.length` and `quarterTurn =
 * Math.floor(rotationIndex / figures.length)`. Cycle length is
 * `figures.length × 4`; a shape with one figure (e.g. a circle) cycles
 * through 4 states (visually invariant due to symmetry), and a shape with
 * two figures (e.g. a cone with cardinal and NE-diagonal variants)
 * cycles through 8 — alternating between the figures each click for a
 * ~45° visual step per click. The decomposition is uniform and the math
 * scales to any number of figures the template declares.
 *
 * Why hardcoded: the catalog is the union of the standard D&D/Pathfinder AoE
 * templates. A user-editable catalog is out of scope — the GM picks from the
 * five hardcoded shapes and casts; the schema stays a closed enum of ids.
 */

type ShapeCell = 0 | 1;
type Pivot = { row: number; col: number };

export type Figure = {
  /** 1/0 grid. Row 0 = northernmost row. `1` = cell is part of the shape. */
  matrix: readonly (readonly ShapeCell[])[];
  /** Pivot cell. Quarter-turns rotate every cell's offset around this pivot. */
  pivot: Pivot;
};

const ROTATION_QUARTER_TURNS = 4 as const;
export type RotationIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SpellTemplate = {
  /** Stable id persisted on `ScenarioEffect.templateId`. */
  id: string;
  /** Human label for the picker UI. Spanish, in the same voice as the rest. */
  label: string;
  /** Hex colour rendered into the marker. */
  color: string;
  /**
   * Visual variants the rotation cycle walks through. Cycle length =
   * `figures.length * 4`. Cones carry two figures (cardinal + NE-diagonal)
   * so the cycle is 8 states; circles carry one figure so the cycle is 4
   * (visually invariant across all states).
   */
  figures: readonly Figure[];
  /** Rotation the picker opens with. */
  defaultRotationIndex: RotationIndex;
};

/** Cone 15 ft (3 rows × 3 cols). Pivot at the southern tip (anchor cell). */
const CONE_15_CARDINAL: readonly (readonly ShapeCell[])[] = [
  [1, 1, 1],
  [1, 1, 1],
  [0, 1, 0],
];

/** Cone 15 ft — NE-diagonal variant. Cells extend along the NE diagonal
 *  from the SW anchor. */
const CONE_15_DIAGONAL: readonly (readonly ShapeCell[])[] = [
  [1, 0, 0],
  [1, 1, 0],
  [1, 1, 1],
];

/** Cone 30 ft (6 rows × 8 cols). Pivot at the southern tip. */
const CONE_30_CARDINAL: readonly (readonly ShapeCell[])[] = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
];

/** Cone 30 ft — NE-diagonal variant. Cells extend along the NE diagonal
 *  from the SW anchor. */
const CONE_30_DIAGONAL: readonly (readonly ShapeCell[])[] = [
  [1, 0, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1],
];

/** Radius 5 ft (2 rows × 2 cols). Pivot at the centre. */
const RADIUS_5_MATRIX: readonly (readonly ShapeCell[])[] = [
  [1, 1],
  [1, 1],
];

/** Radius 10 ft (4 rows × 4 cols). Pivot at the centre. */
const RADIUS_10_MATRIX: readonly (readonly ShapeCell[])[] = [
  [0, 1, 1, 0],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [0, 1, 1, 0],
];

/** Radius 20 ft (8 rows × 8 cols). Pivot at the centre. */
const RADIUS_20_MATRIX: readonly (readonly ShapeCell[])[] = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
];

/** Total cycle length for the catalog (max across all templates). Two cones
 *  carry two figures → 8 states; three circles carry one figure → 4 states. */
export const MAX_CYCLE_SIZE = 8 as const;

/**
 * Five hardcoded templates — two cones (each carries cardinal + NE-diagonal
 * figures so the cycle is 8 states) and three circles (each carries one
 * figure so the cycle is 4 states, all visually invariant).
 *
 * Right-click on the canvas (or the `Q` shortcut) cycles `rotationIndex`
 * one step clockwise through `figures.length × 4` states. The cycle
 * interleaves figures by parity (`rotationIndex % figures.length`) and
 * advances the quarter-turn every Nth state (`Math.floor(rotationIndex /
 * figures.length)`). Cones alternate cardinal ↔ NE-diagonal each click;
 * circles tick the single figure's quarter-turn (visually invariant due to
 * symmetry).
 */
export const SPELL_TEMPLATES = [
  { id: 'cone-15', label: 'Cono 15 pies', color: '#e74c3c',
    figures: [
      { matrix: CONE_15_CARDINAL, pivot: { row: 2, col: 1 } },
      { matrix: CONE_15_DIAGONAL, pivot: { row: 2, col: 0 } },
    ],
    defaultRotationIndex: 0 },
  { id: 'cone-30', label: 'Cono 30 pies', color: '#e67e22',
    figures: [
      { matrix: CONE_30_CARDINAL, pivot: { row: 5, col: 3 } },
      { matrix: CONE_30_DIAGONAL, pivot: { row: 5, col: 0 } },
    ],
    defaultRotationIndex: 0 },
  { id: 'radius-5', label: 'Radio 5 pies', color: '#3498db',
    figures: [
      { matrix: RADIUS_5_MATRIX, pivot: { row: 0, col: 0 } },
    ],
    defaultRotationIndex: 0 },
  { id: 'radius-10', label: 'Radio 10 pies', color: '#2ecc71',
    figures: [
      { matrix: RADIUS_10_MATRIX, pivot: { row: 1, col: 1 } },
    ],
    defaultRotationIndex: 0 },
  { id: 'radius-20', label: 'Radio 20 pies', color: '#9b59b6',
    figures: [
      { matrix: RADIUS_20_MATRIX, pivot: { row: 3, col: 3 } },
    ],
    defaultRotationIndex: 0 },
] as const satisfies readonly SpellTemplate[];

/** Convenience union of the five template ids — the closed enum on the schema. */
export type SpellTemplateId = (typeof SPELL_TEMPLATES)[number]['id'];

/** Cycle length for a template: figures.length × 4 (one full rotation per figure). */
export function cycleSizeFor(template: SpellTemplate): number {
  return template.figures.length * ROTATION_QUARTER_TURNS;
}

/**
 * Cycle the rotation index one step clockwise (idx → idx + 1 mod cycleSize).
 * `cycleSize` is `figures.length × 4`; pass it in from
 * `cycleSizeFor(template)` so the same helper works for cones (8) and
 * circles (4) alike without special-casing the constant 8 anywhere.
 */
export function cycleRotationIndex(
  idx: RotationIndex,
  cycleSize: number,
): RotationIndex {
  return ((idx + 1) % cycleSize) as RotationIndex;
}

/**
 * Resolve a template by id. Falls back to the first template if the id is
 * unknown (defensive — the closed enum should prevent this in practice).
 */
export function templateById(id: string): SpellTemplate {
  return (SPELL_TEMPLATES as readonly SpellTemplate[]).find((t) => t.id === id)
    ?? (SPELL_TEMPLATES[0] as unknown as SpellTemplate);
}

/**
 * Maximum rotation index any template in the catalog accepts. Equals the
 * largest `figures.length × 4 - 1` across all templates (8 for our two cones).
 * Useful for clamping persisted `rotationIndex` values that survived a
 * template-id rename.
 */
export const MAX_ROTATION_INDEX = MAX_CYCLE_SIZE - 1;

