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
  originX: z.number().finite(),
  originY: z.number().finite(),
  widthM: z.number().finite().nonnegative(),
  depthM: z.number().finite().nonnegative(),
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
