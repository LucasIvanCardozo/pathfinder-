import { z } from 'zod';

/** Side enum: which faction a combatant belongs to. The UI uses this to
 *  render colour-coded initiative rows. */
export const SideSchema = z.enum(['players', 'enemies', 'neutral']);

/** Wire shape for inserting a new combatant. Mirrors `Combatant` minus the
 *  server-stamped `id` and `combatId`. */
export const CombatantInsertSchema = z.object({
  name: z.string().min(1).max(120),
  initiative: z.number().int().min(-10).max(40),
  side: SideSchema,
});

/** Persisted combatant shape returned by the read side. */
export const CombatantSchema = CombatantInsertSchema.extend({
  id: z.string().min(1),
  combatId: z.string().min(1),
});

/** Combat view DTO returned by `findByScenario`. Includes `currentTurnIndex`
 *  and `roundNumber` so the client can render the RoundViewer. */
export const CombatViewSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  roundNumber: z.number().int().min(1),
  currentTurnIndex: z.number().int().min(0),
  combatants: z.array(CombatantSchema),
});

/** Op shapes — these go into `scenarioOp.schemas.ts`, but the schema
 *  definitions live here so the combat domain is self-contained. */
export const StartCombatOpSchema = z.object({
  type: z.literal('startCombat'),
  combatants: z.array(CombatantInsertSchema).min(1),
});

export const EndCombatOpSchema = z.object({
  type: z.literal('endCombat'),
});

export const NextTurnOpSchema = z.object({
  type: z.literal('nextTurn'),
});

export const PreviousTurnOpSchema = z.object({
  type: z.literal('previousTurn'),
});

export const AdvanceRoundOpSchema = z.object({
  type: z.literal('advanceRound'),
});

export const AddCombatantOpSchema = z.object({
  type: z.literal('addCombatant'),
  combatant: CombatantInsertSchema,
});

export const RemoveCombatantOpSchema = z.object({
  type: z.literal('removeCombatant'),
  combatantId: z.string().min(1),
});
