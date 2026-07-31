'use client';

import { useMemo } from 'react';
import type { PaintedCell } from '@/lib/shared/types';

/**
 * Buckets `paintedCells` by `floorId` so each FloorCanvas receives only the
 * cells it owns. Returns a fresh map when the input reference changes (i.e.
 * on every paint), which is the success case — the FloorCanvas memo
 * comparator does the field-level diff to skip inactive floors.
 */
export function useFloorCellsByFloor(
  paintedCells: PaintedCell[],
): Map<string, PaintedCell[]> {
  return useMemo(() => {
    const m = new Map<string, PaintedCell[]>();
    for (const cell of paintedCells) {
      const bucket = m.get(cell.floorId);
      if (bucket) {
        bucket.push(cell);
      } else {
        m.set(cell.floorId, [cell]);
      }
    }
    return m;
  }, [paintedCells]);
}
