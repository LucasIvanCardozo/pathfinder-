'use client';

import { useMemo } from 'react';
import type { Floor } from '@/lib/shared/types';

export type VisibleFloors = {
  /** Index of the active floor in the input `floors` array (clamped to 0). */
  activeIndex: number;
  /** Floors from the start of the array up to and including the active one.
   *  Default floor order is bottom→top (Subsuelo 1, Planta Baja, Piso 1), so
   *  these are the floors at or below the active one. Floors ABOVE the active
   *  one are not rendered. */
  visibleFloors: Floor[];
  /** CSS depth tier per visible floor: 0 = active, 1 = one below, etc. */
  depths: number[];
};

/**
 * Slice the floor stack to `floors[0..activeIndex]` (inclusive). Floors above
 * the active one are excluded — they would visually sit on top of the active
 * floor and hide it, which is the opposite of what the editor wants.
 *
 * Defensive fallback: if `activeFloorId` is not found, `activeIndex` clamps to
 * 0 so the canvas still initialises something visible (a degenerate scenario
 * with no matching id renders the first floor instead of an empty stack).
 */
export function useVisibleFloors(floors: Floor[], activeFloorId: string): VisibleFloors {
  const activeIndex = Math.max(
    0,
    floors.findIndex((f) => f.id === activeFloorId),
  );

  const visibleFloors = useMemo(() => floors.slice(0, activeIndex + 1), [floors, activeIndex]);

  const depths = useMemo(
    () => visibleFloors.map((_, idx) => activeIndex - idx),
    [visibleFloors, activeIndex],
  );

  return { activeIndex, visibleFloors, depths };
}
