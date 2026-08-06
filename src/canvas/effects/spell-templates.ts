/**
 * Hardcoded spell templates for the GM's combat spellcasting tool.
 *
 * Single source of truth for spell shapes. The renderer, the picker UI, and
 * the persisted `ScenarioEffect.templateId` all read from `SPELL_TEMPLATES`
 * — adding a new spell is a one-line edit here plus the matrix literal that
 * defines its shape.
 *
 * Each cone template carries two matrices — cardinal (south-pointing pivot)
 * and NE-diagonal (SW-pointing pivot) — selected at runtime by
 * `rotationIndex % 2`. The walker in `footprint.ts` enumerates the matrix,
 * rotates each cell's offset around the pivot by `Math.floor(rotationIndex / 2)`
 * quarter-turns (90° clockwise in screen coords, Y grows downward), and emits
 * the result in world coordinates. The matrix IS the shape — there is no
 * per-shape dispatch, no feet conversion, no halfCells ramp. Row 0 of the
 * matrix is the northernmost row.
 *
 * Cones pivot at the southern tip (the anchor cell); circles pivot at the
 * centre. Right-click on the canvas (or the `Q` shortcut) cycles
 * `rotationIndex` through 0..7, which alternately picks the cardinal and
 * diagonal matrices and rotates by 0/1/2/3 quarter-turns. Circles repeat
 * the same matrix on cardinal and diagonal, so the cycle is visually a
 * no-op for them.
 *
 * Why hardcoded: the catalog is the union of the standard D&D/Pathfinder AoE
 * templates. A user-editable catalog is out of scope — the GM picks from the
 * five hardcoded shapes and casts; the schema stays a closed enum of ids.
 */

type ShapeCell = 0 | 1;
type Pivot = { row: number; col: number };

const ROTATION_STATES = 8 as const;
export type RotationIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SpellTemplate = {
  /** Stable id persisted on `ScenarioEffect.templateId`. */
  id: string;
  /** Human label for the picker UI. Spanish, in the same voice as the rest. */
  label: string;
  /** Hex colour rendered into the marker. */
  color: string;
  /**
   * Cardinal (south-pointing) matrix + pivot. Picked when
   * `rotationIndex % 2 === 0`.
   */
  cardinal: { matrix: readonly (readonly ShapeCell[])[]; pivot: Pivot };
  /**
   * NE-diagonal (SW-anchored) matrix + pivot. Picked when
   * `rotationIndex % 2 === 1`.
   */
  diagonal: { matrix: readonly (readonly ShapeCell[])[]; pivot: Pivot };
  /**
   * Rotation the picker opens with. The right-click on canvas / `Q` shortcut
   * cycles it in 8 steps (0..7). The reset-on-template-change hook in
   * `EditorClient` honours this default.
   */
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

/**
 * Five hardcoded templates — two cones (one matrix pair per cone size: the
 * cardinal south-pointing orientation and the NE-diagonal orientation that
 * `rotationIndex % 2 === 1` selects) and three circles. Circles share the
 * same matrix on both slots, so cycling the rotation is a visual no-op for
 * them without special-casing any code path. Right-click on the canvas (or
 * the `Q` shortcut) cycles `rotationIndex` through 0..7 — eight states that
 * alternate cardinal/diagonal and rotate by 0/90/180/270°
 * (`Math.floor(idx / 2)` within each orientation).
 */
export const SPELL_TEMPLATES = [
  { id: 'cone-15', label: 'Cono 15 pies', color: '#e74c3c',
    cardinal: { matrix: CONE_15_CARDINAL, pivot: { row: 2, col: 1 } },
    diagonal: { matrix: CONE_15_DIAGONAL, pivot: { row: 2, col: 0 } },
    defaultRotationIndex: 0 },
  { id: 'cone-30', label: 'Cono 30 pies', color: '#e67e22',
    cardinal: { matrix: CONE_30_CARDINAL, pivot: { row: 5, col: 3 } },
    diagonal: { matrix: CONE_30_DIAGONAL, pivot: { row: 5, col: 0 } },
    defaultRotationIndex: 0 },
  { id: 'radius-5', label: 'Radio 5 pies', color: '#3498db',
    cardinal: { matrix: RADIUS_5_MATRIX, pivot: { row: 0, col: 0 } },
    diagonal: { matrix: RADIUS_5_MATRIX, pivot: { row: 0, col: 0 } },
    defaultRotationIndex: 0 },
  { id: 'radius-10', label: 'Radio 10 pies', color: '#2ecc71',
    cardinal: { matrix: RADIUS_10_MATRIX, pivot: { row: 1, col: 1 } },
    diagonal: { matrix: RADIUS_10_MATRIX, pivot: { row: 1, col: 1 } },
    defaultRotationIndex: 0 },
  { id: 'radius-20', label: 'Radio 20 pies', color: '#9b59b6',
    cardinal: { matrix: RADIUS_20_MATRIX, pivot: { row: 3, col: 3 } },
    diagonal: { matrix: RADIUS_20_MATRIX, pivot: { row: 3, col: 3 } },
    defaultRotationIndex: 0 },
] as const satisfies readonly SpellTemplate[];

/** Convenience union of the five template ids — the closed enum on the schema. */
export type SpellTemplateId = (typeof SPELL_TEMPLATES)[number]['id'];

/**
 * Cycle the rotation index one step clockwise (0→1→…→7→0). The eight states
 * alternate cardinal/diagonal (parity) and rotate by 0/90/180/270° within each
 * orientation (`Math.floor(idx / 2)`), so the same helper works for cones and circles
 * alike — for circles it's a visual no-op because cardinal.matrix ===
 * diagonal.matrix.
 */
export function cycleRotationIndex(idx: RotationIndex): RotationIndex {
  return ((idx + 1) % ROTATION_STATES) as RotationIndex;
}

/**
 * Resolve a template by id. Falls back to the first template if the id is
 * unknown (defensive — the closed enum should prevent this in practice).
 */
export function templateById(id: string): SpellTemplate {
  return SPELL_TEMPLATES.find((t) => t.id === id) ?? SPELL_TEMPLATES[0];
}

