/**
 * Hardcoded spell templates for the GM's combat spellcasting tool.
 *
 * Single source of truth for spell shapes. The renderer, the picker UI, and
 * the persisted `ScenarioEffect.templateId` all read from `SPELL_TEMPLATES`
 * — adding a new spell is a one-line edit here plus the matrix literal that
 * defines its shape.
 *
 * Each shape is a 1/0 grid (`matrix`) plus an explicit pivot cell. The walker
 * in `footprint.ts` enumerates the matrix, rotates each cell's offset around
 * the pivot, and emits the result in world coordinates. The matrix IS the
 * shape — there is no per-shape dispatch, no feet conversion, no halfCells
 * ramp. Row 0 of the matrix is the northernmost row; rotation is 90° clockwise
 * in screen coords (Y grows downward).
 *
 * Cones pivot at the southern tip (the anchor cell); circles pivot at the
 * centre. The rotate button can move any template to any of the four
 * cardinal positions; circles ignore `defaultRotationDeg` at render time.
 *
 * Why hardcoded: the catalog is the union of the standard D&D/Pathfinder AoE
 * templates. A user-editable catalog is out of scope — the GM picks from the
 * seven hardcoded shapes and casts; the schema stays a closed enum of ids.
 */

type ShapeCell = 0 | 1;
type Pivot = { row: number; col: number };

export const ROTATIONS = [0, 90, 180, 270] as const;
export type RotationDeg = (typeof ROTATIONS)[number];

export type SpellTemplate = {
  /** Stable id persisted on `ScenarioEffect.templateId`. */
  id: string;
  /** Human label for the picker UI. Spanish, in the same voice as the rest. */
  label: string;
  /** Hex colour rendered into the marker. */
  color: string;
  /** 1/0 grid. Row 0 = northernmost row. `1` = cell is part of the shape. */
  matrix: readonly (readonly ShapeCell[])[];
  /** Pivot cell. Rotation transforms each cell offset around this pivot. */
  pivot: Pivot;
  /**
   * Rotation the picker opens with. The GM cycles it with the rotate button
   * in 90° steps. Circles ignore this field at render time.
   */
  defaultRotationDeg: RotationDeg;
};

/** Cone 15 ft (4 rows × 3 cols). Pivot at the southern tip (anchor cell). */
const CONE_15_MATRIX: readonly (readonly ShapeCell[])[] = [
  [1, 1, 1],
  [1, 1, 1],
  [0, 1, 0],
];
const CONE_15_PIVOT: Pivot = { row: 2, col: 1 };

/** Cone 15 ft — diagonal variant. The cells extend along the NE diagonal from
 *  the anchor instead of straight north. Pivot at the anchor (SW corner). */
const CONE_15_DIAGONAL_MATRIX: readonly (readonly ShapeCell[])[] = [
  [1, 0, 0],
  [1, 1, 0],
  [1, 1, 1],
];
const CONE_15_DIAGONAL_PIVOT: Pivot = { row: 2, col: 0 };

/** Cone 30 ft (7 rows × 7 cols). Pivot at the southern tip. */
const CONE_30_MATRIX: readonly (readonly ShapeCell[])[] = [
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
];
const CONE_30_PIVOT: Pivot = { row: 5, col: 3 };

/** Cone 30 ft — diagonal variant. The cells extend along the NE diagonal from
 *  the anchor. Pivot at the anchor (SW corner). */
const CONE_30_DIAGONAL_MATRIX: readonly (readonly ShapeCell[])[] = [
  [1, 0, 0, 0, 0, 0],
  [1, 1, 1, 0, 0, 0],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1],
];
const CONE_30_DIAGONAL_PIVOT: Pivot = { row: 5, col: 0 };

/** Radius 5 ft (3 rows × 3 cols). Pivot at the centre. */
const RADIUS_5_MATRIX: readonly (readonly ShapeCell[])[] = [
  [1, 1],
  [1, 1],
];
const RADIUS_5_PIVOT: Pivot = { row: 0, col: 0 };

/** Radius 10 ft (5 rows × 5 cols). Pivot at the centre. */
const RADIUS_10_MATRIX: readonly (readonly ShapeCell[])[] = [
  [0, 1, 1, 0],
  [1, 1, 1, 1],
  [1, 1, 1, 1],
  [0, 1, 1, 0],
];
const RADIUS_10_PIVOT: Pivot = { row: 1, col: 1 };

/** Radius 20 ft (9 rows × 9 cols). Pivot at the centre. */
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
const RADIUS_20_PIVOT: Pivot = { row: 3, col: 3 };

/**
 * Seven hardcoded templates — four cones (two sizes × two matrix orientations:
 * cardinal grid-aligned and diagonal NE-aligned) and three circles. Cardinal
 * and diagonal cones are distinct matrices; the diagonal variant cannot be
 * derived from the cardinal matrix by a 90° rotation around its pivot. The
 * rotate button can move any template to any of the four cardinal positions.
 */
export const SPELL_TEMPLATES = [
  { id: 'cone-15-cardinal', label: 'Cono 15 pies (cardinal)', color: '#e74c3c',
    matrix: CONE_15_MATRIX, pivot: CONE_15_PIVOT, defaultRotationDeg: 0 },
  { id: 'cone-15-diagonal', label: 'Cono 15 pies (diagonal)', color: '#e74c3c',
    matrix: CONE_15_DIAGONAL_MATRIX, pivot: CONE_15_DIAGONAL_PIVOT, defaultRotationDeg: 0 },
  { id: 'cone-30-cardinal', label: 'Cono 30 pies (cardinal)', color: '#e67e22',
    matrix: CONE_30_MATRIX, pivot: CONE_30_PIVOT, defaultRotationDeg: 0 },
  { id: 'cone-30-diagonal', label: 'Cono 30 pies (diagonal)', color: '#e67e22',
    matrix: CONE_30_DIAGONAL_MATRIX, pivot: CONE_30_DIAGONAL_PIVOT, defaultRotationDeg: 0 },
  { id: 'radius-5', label: 'Radio 5 pies', color: '#3498db',
    matrix: RADIUS_5_MATRIX, pivot: RADIUS_5_PIVOT, defaultRotationDeg: 0 },
  { id: 'radius-10', label: 'Radio 10 pies', color: '#2ecc71',
    matrix: RADIUS_10_MATRIX, pivot: RADIUS_10_PIVOT, defaultRotationDeg: 0 },
  { id: 'radius-20', label: 'Radio 20 pies', color: '#9b59b6',
    matrix: RADIUS_20_MATRIX, pivot: RADIUS_20_PIVOT, defaultRotationDeg: 0 },
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
