import type { z } from 'zod';
import type {
  ScenarioOpSchema,
  ScenarioSaveRequestSchema,
} from '@/lib/shared/schemas/scenarioOp.schemas';
import type { Floor } from '@/lib/shared/types/floor.types';

/**
 * The shape of `entityState` for a painted cell. Mirrors the Zod schema in
 * `paintedCell.schemas.ts` — duplicated here to avoid the cycle
 * `paintedCell.schemas ↔ scenarioOp.schemas` (Zod uses runtime values, types
 * use the inferred type).
 */
export type EntityState = Record<string, string | number | boolean> | undefined;

/**
 * A single editor mutation, replayed server-side inside one transaction.
 *
 * Operations are **ordered** — the server applies them in the order they
 * arrive. The client also keeps a local `paintedCells[]` array for render;
 * ops are a side-channel used only by `saveScenarioOps`. This is the same
 * shape that lets us drop the entire scenario from the wire and ship just
 * what changed since the last successful save (memory observation
 * "pathfinder-diff-based-autosave").
 *
 * Discriminated union — exhaustiveness is enforced by the Zod schema.
 * Adding a new op type means: add it here, in the schema, in the client
 * buffer helper, and in the server replay switch.
 */
export type ScenarioOp = z.infer<typeof ScenarioOpSchema>;

/**
 * The wire shape for `saveScenarioOps`. Either `initialState` (first save)
 * or `ops` (subsequent saves) must be present, never both empty.
 *
 * `baselineVersion` is the `updatedAt` timestamp of the scenario at the
 * moment the client started accumulating ops. The server may use it for
 * optimistic concurrency in the future; for now we accept any version
 * (last-write-wins, same as the previous full-state save).
 */
export type ScenarioSaveRequest = z.infer<typeof ScenarioSaveRequestSchema>;

/**
 * Convenience for the server replay switch — narrows `ScenarioOp` by
 * `type`. Use inside `case 'X':` arms for type-safe `op` access.
 */
export type ScenarioOpOfType<T extends ScenarioOp['type']> = Extract<ScenarioOp, { type: T }>;

/** Subset of `Floor` used in the `addFloor` op (id is generated client-side). */
export type FloorForOp = Floor;
