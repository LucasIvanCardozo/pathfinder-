import type { Floor } from '@/lib/shared/types';

/**
 * Canonical Spanish display names for the default floors of a brand-new
 * scenario. Order matters: index 0 is the lowest floor.
 */
export const DEFAULT_FLOOR_NAMES: readonly string[] = ['Subsuelo 1', 'Planta Baja', 'Piso 1'];

/** Returns true if the given floor name (trimmed, lowercased) is "planta baja". */
export function isPlantaBajaName(name: string): boolean {
  return name.trim().toLowerCase() === 'planta baja';
}

/** Returns the index of the floor named "Planta Baja" (case-insensitive), or -1. */
export function findPlantaBajaIndex(floors: readonly Floor[]): number {
  return floors.findIndex((f) => isPlantaBajaName(f.name));
}

/**
 * Returns the display name for a floor at the given index, given the full
 * floor list (needed to locate "Planta Baja"). Naming convention:
 *   - "Planta Baja" if there's exactly one Planta Baja in the list.
 *   - "Subsuelo N" for floors below Planta Baja (N = 1 for the first sub).
 *   - "Piso N" for floors above Planta Baja (N = 1 for the first piso).
 *   - If no Planta Baja exists, floors are named "Piso N" where N is the index.
 */
export function floorNameForIndex(floors: readonly Floor[], index: number): string {
  const pbIndex = findPlantaBajaIndex(floors);
  if (index === pbIndex) return 'Planta Baja';
  if (pbIndex === -1) return `Piso ${index}`;
  if (index < pbIndex) return `Subsuelo ${pbIndex - index}`;
  return `Piso ${index - pbIndex}`;
}
