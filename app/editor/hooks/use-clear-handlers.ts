'use client';

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Floor, PaintedCell } from '@/lib/shared/types';

type UseClearHandlersArgs = {
  opsBuffer: {
    pushClearAll: () => void;
    pushClearFloor: (floorId: string) => void;
    pushClearSubdivision: (floorId: string, subdivisionId: string) => void;
  };
  activeFloor: Floor;
  activeSubdivisionId: string;
  /** Display name of the active subdivision (used only in the confirm dialog). */
  activeSubdivisionName?: string;
  markDirty: () => void;
  setPaintedCells: Dispatch<SetStateAction<PaintedCell[]>>;
};

export type UseClearHandlers = {
  handleClearAll: () => void;
  handleClearFloor: () => void;
  handleClearSubdivision: () => void;
};

/**
 * Unifies the three delete-everything handlers. Each prompts with `confirm()`
 * (Spanish copy) and pushes the matching op to the autosave buffer. Handlers
 * fire on user click only — keeping deps simple is more valuable than
 * `useCallback` stability.
 */
export function useClearHandlers({
  opsBuffer,
  activeFloor,
  activeSubdivisionId,
  activeSubdivisionName,
  markDirty,
  setPaintedCells,
}: UseClearHandlersArgs): UseClearHandlers {
  const handleClearAll = useCallback(() => {
    if (!confirm('¿Borrar TODO el scenario (pintadas de todos los pisos)? No se puede deshacer.'))
      return;
    setPaintedCells([]);
    opsBuffer.pushClearAll();
    markDirty();
  }, [opsBuffer, markDirty, setPaintedCells]);

  const handleClearFloor = useCallback(() => {
    if (
      !confirm(`¿Borrar todas las celdas pintadas de "${activeFloor.name}"? No se puede deshacer.`)
    )
      return;
    const fid = activeFloor.id;
    setPaintedCells((prev) => prev.filter((c) => c.floorId !== fid));
    opsBuffer.pushClearFloor(fid);
    markDirty();
  }, [activeFloor.id, activeFloor.name, opsBuffer, markDirty, setPaintedCells]);

  const handleClearSubdivision = useCallback(() => {
    if (!activeSubdivisionId) return;
    const subName = activeSubdivisionName ?? activeSubdivisionId;
    if (
      !confirm(
        `¿Borrar todas las celdas pintadas de "${subName}" en "${activeFloor.name}"? No se puede deshacer.`,
      )
    )
      return;
    const fid = activeFloor.id;
    const sid = activeSubdivisionId;
    setPaintedCells((prev) => prev.filter((c) => !(c.floorId === fid && c.subdivisionId === sid)));
    opsBuffer.pushClearSubdivision(fid, sid);
    markDirty();
  }, [
    activeFloor.id,
    activeFloor.name,
    activeSubdivisionId,
    activeSubdivisionName,
    opsBuffer,
    markDirty,
    setPaintedCells,
  ]);

  return {
    handleClearAll,
    handleClearFloor,
    handleClearSubdivision,
  };
}