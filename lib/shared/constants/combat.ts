import type { Side } from '@/lib/shared/types/combat.types';

/** Side label shown in the RoundViewer and CombatModal. */
export const SIDE_LABEL: Record<Side, string> = {
  players: 'Jugadores',
  enemies: 'Enemigos',
  neutral: 'Neutrales',
};

/** Combatant name length cap (mirrors `Combatant.name.max(120)`). */
export const COMBATANT_NAME_MAX = 120;

/** Initiative bounds (mirrors `Combatant.initiative` Zod range). */
export const INITIATIVE_MIN = -10;
export const INITIATIVE_MAX = 40;

/** Operational flags. */
export const COMBAT_TRACKER_ENABLED = true;
