import type { z } from 'zod';
import type { EffectInputSchema, ScenarioEffectSchema, SpellTemplateIdSchema } from '@/lib/shared/schemas/effect.schemas';

/** Closed enum of the seven hardcoded template ids. */
export type SpellTemplateId = z.infer<typeof SpellTemplateIdSchema>;

/** Wire shape for the `addEffect` op. */
export type EffectInput = z.infer<typeof EffectInputSchema>;

/** Persisted shape returned by the read side (server-stamped scenarioId). */
export type ScenarioEffect = z.infer<typeof ScenarioEffectSchema>;
