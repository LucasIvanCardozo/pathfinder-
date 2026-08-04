import { z } from 'zod';
import { SPELL_TEMPLATES } from '@/canvas/effects/spell-templates';

/**
 * Wire + persisted shape for a GM-cast spell on a floor (PR 1 of the
 * spellcasting refactor).
 *
 * Shape is resolved from `templateId` against `SPELL_TEMPLATES` at read time;
 * the schema is closed over the seven hardcoded ids so an unknown id fails
 * validation before it can poison the read side. `rotationDeg` is discrete
 * (0/90/180/270); the walker snaps to the nearest cardinal before walking.
 *
 * `originCellX` / `originCellY` are integer cell coords in the active
 * subdivision's grid space (no Float — sub-cell anchors are out of scope).
 *
 * `casterCombatantId` is nullable because removing a caster mid-spell cascades
 * the FK to SetNull rather than deleting the row (see `schema.prisma`). A
 * spell whose caster was removed is rendered as an orphan and cleaned up on
 * the next scenario load.
 *
 * `castOnTurnIndex` / `castOnRoundNumber` are the combat cursor snapshot at
 * cast time. The expiry rule (server-side, `nextTurn`/`advanceRound`) reads
 * these to decide whether to delete the spell: the spell dies when the
 * cursor reaches its caster again on a later round.
 */

const SPELL_TEMPLATE_IDS = SPELL_TEMPLATES.map((t) => t.id) as [
  (typeof SPELL_TEMPLATES)[number]['id'],
  ...(typeof SPELL_TEMPLATES)[number]['id'][],
];

export const SpellTemplateIdSchema = z.enum(SPELL_TEMPLATE_IDS);

export const ROTATIONS = [0, 90, 180, 270] as const;
export const RotationDegSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

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
  rotationDeg: RotationDegSchema.default(0),
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
