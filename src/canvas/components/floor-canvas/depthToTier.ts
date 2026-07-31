/**
 * Maps the floor's depth from active into a CSS tier class. Capped at tier3 —
 * anything deeper uses the deepest tier style.
 */
export function depthToTier(d: number): 0 | 1 | 2 | 3 {
  if (d <= 0) return 0;
  if (d === 1) return 1;
  if (d === 2) return 2;
  return 3;
}
