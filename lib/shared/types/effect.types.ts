import type { z } from 'zod';
import type {
  EffectDurationKindSchema,
  EffectFormSchema,
  EffectInputSchema,
  EffectKindSchema,
  ScenarioEffectSchema,
} from '@/lib/shared/schemas/effect.schemas';

/** Geometric shape of the marker. */
export type EffectKind = z.infer<typeof EffectKindSchema>;

/** Decrement policy for `remainingRounds`. */
export type EffectDurationKind = z.infer<typeof EffectDurationKindSchema>;

/** Wire shape for the `addEffect` op. */
export type EffectInput = z.infer<typeof EffectInputSchema>;

/** Modal-level form shape (subset of `EffectInput` excluding id / floorId /
 *  createdAt / updatedAt). The hook pads the missing fields on submit. */
export type EffectFormInput = z.infer<typeof EffectFormSchema>;

/** Persisted shape returned by the read side (server-stamped timestamps). */
export type ScenarioEffect = z.infer<typeof ScenarioEffectSchema>;

/** Convenience for narrowing an effect by its `kind`. */
export type ScenarioEffectOfKind<K extends EffectKind> = ScenarioEffect & { kind: K };
