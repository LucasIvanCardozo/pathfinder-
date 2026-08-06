import { z } from 'zod';
import { SPELL_TEMPLATES } from '@/canvas/effects/spell-templates';

/**
 * Wire + persisted shape for a GM-cast spell on a floor (PR 1 of the
 * spellcasting refactor).
 *
 * Shape is resolved from `templateId` against `SPELL_TEMPLATES` at read time;
 * the schema is closed over the five hardcoded ids so an unknown id fails
 * validation before it can poison the read side. `rotationIndex` is an
 * integer in `[0..MAX_CYCLE_SIZE-1]`. Cycle length per template is
 * `figures.length × 4` and the cycle interleaves figures by parity:
 * `figureIdx = rotationIndex % figures.length`,
 * `quarterTurn = Math.floor(rotationIndex / figures.length)`. Cones cycle
 * through 8 states (2 figures × 4 quarter-turns, alternating each click
 * for ~45° visual steps); circles cycle through 4 (visually invariant due
 * to symmetry). The walker snaps with `Math.round` + clamp as a safety net
 * for legacy rows outside the range.
 *
 * `originCellX` / `originCellY` are integer cell coords in the active
 * subdivision's grid space (no Float — sub-cell anchors are out of scope).
 *
 * `durationRounds` is the PF1e spell lifetime in world rounds: the server
 * decrements it on every `nextTurn` / `advanceRound` op and deletes the row
 * in the same TX when it hits zero. Capped at 1-99 so the SpellPalette
 * input stays sane; default 1 preserves the legacy one-round behaviour.
 *
 * `casterCombatantId` is nullable because removing a caster mid-spell cascades
 * the FK to SetNull rather than deleting the row (see `schema.prisma`). A
 * spell whose caster was removed is rendered as an orphan and cleaned up on
 * the next scenario load. `casterCombatantId` is metadata only — the expiry
 * rule is world-round-based and does not consult it.
 *
 * `castOnTurnIndex` / `castOnRoundNumber` are the combat cursor snapshot at
 * cast time. Still persisted (audit + orphan cleanup) but no longer read by
 * the expiry rule.
 */

const SPELL_TEMPLATE_IDS = SPELL_TEMPLATES.map((t) => t.id) as [
  (typeof SPELL_TEMPLATES)[number]['id'],
  ...(typeof SPELL_TEMPLATES)[number]['id'][],
];

export const SpellTemplateIdSchema = z.enum(SPELL_TEMPLATE_IDS);

export const RotationIndexSchema = z.number().int().min(0).max(7);

/**
 * Wire shape sent by the client in an `addEffect` op. Mirrors the columns of
 * the `ScenarioEffect` model except `scenarioId` (the server sets it from
 * the wrapping transaction).
 */
export const EffectInputSchema = z.object({
  id: z.string().min(1),
  floorId: z.string().min(1),
  templateId: SpellTemplateIdSchema,
  originCellX: z.number().int(),
  originCellY: z.number().int(),
  rotationIndex: RotationIndexSchema.default(0),
  durationRounds: z.number().int().min(1).max(99).default(1),
  casterCombatantId: z.string().min(1).nullable(),
  castOnTurnIndex: z.number().int().min(0),
  castOnRoundNumber: z.number().int().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/** Persisted shape returned by the read side (server-stamped scenarioId). */
export const ScenarioEffectSchema = EffectInputSchema.extend({
  scenarioId: z.string().min(1),
});
