import type { z } from 'zod';
import type {
  CombatantInsertSchema,
  CombatantSchema,
  CombatViewSchema,
  SideSchema,
} from '@/lib/shared/schemas/combat.schemas';

export type Side = z.infer<typeof SideSchema>;
export type CombatantInsert = z.infer<typeof CombatantInsertSchema>;
export type Combatant = z.infer<typeof CombatantSchema>;
export type CombatView = z.infer<typeof CombatViewSchema>;
