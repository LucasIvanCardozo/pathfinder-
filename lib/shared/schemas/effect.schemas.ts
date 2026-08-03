import { z } from 'zod';

/**
 * Schemas for the GM-placed effects overlay (PR 1 of
 * `effects-and-combat-tracker`). Each `ScenarioEffect` is a translucent
 * marker on a floor with a rectangular footprint (the wall-aware BFS that
 * replaces this stub lives in PR 2, design §12.2).
 *
 * Persistence lives in `ScenarioEffect` (Prisma) and replays through the
 * `addEffect` / `removeEffect` / `tickRound` ops in `scenarioOp.schemas.ts`.
 */

/** Geometric shape of the marker. PR 1 renders all four kinds the same way
 *  (rectangular footprint); the per-shape geometry ships in PR 2. */
export const EffectKindSchema = z.enum(['burst', 'cone', 'line', 'wall']);

/** How `remainingRounds` decrements. PR 1 only honours `rounds` and
 *  `rounds-concentration` via the `tickRound` op; the others land in a later
 *  PR per design §11.4. */
export const EffectDurationKindSchema = z.enum([
  'rounds',
  'rounds-concentration',
  'minutes',
  'concentration',
]);

/**
 * Wire shape sent by the client in an `addEffect` op. Mirrors the columns of
 * the `ScenarioEffect` model except `scenarioId` (the server sets it from
 * the wrapping transaction so the client never has to know which scenario
 * it's editing). Defaults for `rotationDeg` and `expired` match the Prisma
 * `@default` values; `id` is generated client-side via `newId('effect')` and
 * `createdAt` / `updatedAt` are server-stamped on insert (the client still
 * sends them so the type stays closed).
 */
export const EffectInputSchema = z.object({
  id: z.string().min(1),
  floorId: z.string().min(1),
  label: z.string().min(1).max(120),
  kind: EffectKindSchema,
  /** Anchor cell coordinate on the active subdivision's grid (X axis).
   *  Stored as a `Float` on the Prisma row so the wire is forward-compatible
   *  with future sub-cell anchors, but the modal pre-fills with integer
   *  `gridX` values from the cell the GM clicked. */
  originCellX: z.number().finite(),
  /** Anchor cell coordinate on the active subdivision's grid (Y axis). See
   *  `originCellX` for the Float / integer rationale. */
  originCellY: z.number().finite(),
  /** Footprint width in feet. The canvas converts to active-subdivision cells
   *  via `widthFt * cellSizeRatio / FEET_PER_BASE_CELL`. */
  widthFt: z.number().finite().nonnegative(),
  /** Footprint depth (forward length) in feet. Same conversion as `widthFt`. */
  depthFt: z.number().finite().nonnegative(),
  rotationDeg: z.number().finite().default(0),
  color: z.string().min(1),
  durationKind: EffectDurationKindSchema,
  remainingRounds: z.number().int(),
  expired: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/** Persisted `ScenarioEffect` shape returned by `findByIdWithFloors`. Adds
 *  `scenarioId` on top of `EffectInputSchema` because the row always carries
 *  the owning scenario's id server-side. */
export const ScenarioEffectSchema = EffectInputSchema.extend({
  scenarioId: z.string().min(1),
});

/**
 * Form-level schema for the EffectsModal. The modal pre-fills every field
 * (including `id`, `floorId`, `createdAt`, `updatedAt` via `defaultValues`)
 * and react-hook-form preserves them through submit. The resolver therefore
 * must NOT omit them — `@hookform/resolvers/zod` strips fields the schema
 * does not declare, which would drop `id`/`floorId`/timestamps from the
 * parsed `data` and the op sent to the server would fail validation.
 *
 * The only relaxation vs. `EffectInputSchema` is `label`: we allow empty
 * strings so the form starts blank, and the hook falls back to the literal
 * "Marcador" when the user submits without typing (preserves the PR 2
 * behaviour where a blank label still produces a valid op).
 */
export const EffectFormSchema = EffectInputSchema.extend({
  label: z.string().max(120),
});
