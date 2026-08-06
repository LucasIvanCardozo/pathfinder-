import { z } from 'zod';
import { FLOOR_LIMITS, SCENARIO_LIMITS } from '@/lib/shared/constants';
import { EffectInputSchema } from '@/lib/shared/schemas/effect.schemas';
import {
  AddCombatantOpSchema,
  AdvanceRoundOpSchema,
  EndCombatOpSchema,
  NextTurnOpSchema,
  PreviousTurnOpSchema,
  RemoveCombatantOpSchema,
  StartCombatOpSchema,
} from './combat.schemas';

/**
 * Discriminated union of editor mutations. Each variant maps to one server
 * replay arm in `scenario.repository.applyOpsInTx`. Keep these in sync:
 * adding an op here requires touching the client buffer, the server replay,
 * and the autosave wire shape.
 */
export const ScenarioOpSchema = z.discriminatedUnion('type', [
  /**
   * Upsert painted cells at the given floor/subdivision grid positions.
   * Cells are matched by `id` — if a cell with the same id already exists in
   * the DB it is overwritten, otherwise it is created.
   */
  z.object({
    type: z.literal('paintCells'),
    floorId: z.string().min(1),
    subdivisionId: z.string().min(1),
    cells: z
      .array(
        z.object({
          id: z.string().min(1),
          gridX: z.number().int(),
          gridY: z.number().int(),
          pieceId: z.string().min(1),
          entityState: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .optional(),
        }),
      )
      .min(1),
  }),

  /** Delete painted cells by id. Missing ids are silently ignored. */
  z.object({
    type: z.literal('eraseCells'),
    cellIds: z.array(z.string().min(1)).min(1),
  }),

  /** Update only the `entityState` field of an existing cell. */
  z.object({
    type: z.literal('setEntityState'),
    cellId: z.string().min(1),
    entityState: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).nullable(),
  }),

  /** Delete every painted cell of the scenario. */
  z.object({ type: z.literal('clearAllCells') }),

  /** Delete every painted cell of one floor. */
  z.object({ type: z.literal('clearFloor'), floorId: z.string().min(1) }),

  /** Delete every painted cell of one (floor, subdivision) pair. */
  z.object({
    type: z.literal('clearSubdivision'),
    floorId: z.string().min(1),
    subdivisionId: z.string().min(1),
  }),

  /** Add a new floor at the top or bottom of the stack. */
  z.object({
    type: z.literal('addFloor'),
    floor: z.object({ id: z.string().min(1), name: z.string().min(1).max(FLOOR_LIMITS.NAME_MAX) }),
    position: z.enum(['above', 'below']),
  }),

  /** Update the scenario's display name. */
  z.object({
    type: z.literal('setScenarioName'),
    name: z.string().min(1).max(SCENARIO_LIMITS.NAME_MAX),
  }),

  /** Place a new GM-placed effect on a floor. Persisted as a `ScenarioEffect`
   *  row; the canvas hook renders it from the effect's footprint. */
  z.object({
    type: z.literal('addEffect'),
    effect: EffectInputSchema,
  }),

  /** Remove an effect by id. Missing ids are silently ignored (idempotent)
   *  so the client can replay a stale op without surfacing an error. */
  z.object({
    type: z.literal('removeEffect'),
    effectId: z.string().min(1),
  }),

  StartCombatOpSchema,
  EndCombatOpSchema,
  NextTurnOpSchema,
  PreviousTurnOpSchema,
  AdvanceRoundOpSchema,
  AddCombatantOpSchema,
  RemoveCombatantOpSchema,
]);

/**
 * The full save payload. `initialState` is required for the very first save
 * (no baseline to diff against) and the server seeds the scenario from it.
 * Subsequent saves send only `ops`.
 *
 * `baselineVersion` is the `updatedAt` the client started accumulating ops
 * against; the server may use it for optimistic concurrency later. We pass
 * it through today but don't reject on mismatch (last-write-wins).
 */
export const ScenarioSaveRequestSchema = z.object({
  scenarioId: z.string().min(1).nullable(),
  baselineVersion: z.string().nullable(),
  ops: z.array(ScenarioOpSchema),
  // First-save payload: full scenario shape (floors + paintedCells + mapDims).
  // Required when `scenarioId === null`; optional on subsequent saves.
  initialState: z
    .object({
      name: z.string().min(1).max(SCENARIO_LIMITS.NAME_MAX),
      baseCellSize: z
        .number()
        .int()
        .min(SCENARIO_LIMITS.BASE_CELL_SIZE.MIN)
        .max(SCENARIO_LIMITS.BASE_CELL_SIZE.MAX),
      width: z.number().int().min(SCENARIO_LIMITS.DIMENSION.MIN).max(SCENARIO_LIMITS.DIMENSION.MAX),
      height: z
        .number()
        .int()
        .min(SCENARIO_LIMITS.DIMENSION.MIN)
        .max(SCENARIO_LIMITS.DIMENSION.MAX),
      floors: z
        .array(
          z.object({ id: z.string().min(1), name: z.string().min(1).max(FLOOR_LIMITS.NAME_MAX) }),
        )
        .min(1),
      paintedCells: z.array(
        z.object({
          id: z.string().min(1),
          floorId: z.string().min(1),
          subdivisionId: z.string().min(1),
          gridX: z.number().int(),
          gridY: z.number().int(),
          pieceId: z.string().min(1),
          entityState: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .optional(),
        }),
      ),
    })
    .optional(),
});
