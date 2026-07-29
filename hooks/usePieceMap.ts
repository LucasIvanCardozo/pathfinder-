'use client';

import { useMemo } from 'react';
import type { Piece } from '@/lib/shared/types';

/**
 * Builds a stable `id -> Piece` lookup from a piece list. The map is rebuilt
 * only when the input array reference changes, so passing a memoized prop is
 * safe — but do not pass new array literals on every render.
 */
export function usePieceMap(pieces: readonly Piece[]): Map<string, Piece> {
  return useMemo(() => {
    const m = new Map<string, Piece>();
    for (const p of pieces) m.set(p.id, p);
    return m;
  }, [pieces]);
}
