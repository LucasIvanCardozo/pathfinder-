'use client';

import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
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
  /**
   * Read-only view of the current painted cells, mirrored in a ref so we can
   * decide if a "clear" would actually change anything without re-creating
   * the handlers when the cells array changes (which would break memoized
   * children of the editor).
   */
  paintedCellsRef: MutableRefObject<readonly PaintedCell[]>;
  /** Snapshot the editor's state into the undo stack. Called after the user
   *  confirms AND the clear would actually change something. */
  recordHistory: () => void;
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
 *
 * All three handlers short-circuit when the target scope is already empty:
 * no undo snapshot is recorded, no op is sent to the buffer, no re-render
 * is triggered. This keeps the undo stack free of "nothing changed" entries
 * and prevents the autosave timer from being armed by a no-op clear.
 */
export function useClearHandlers({
  opsBuffer,
  activeFloor,
  activeSubdivisionId,
  activeSubdivisionName,
  markDirty,
  setPaintedCells,
  paintedCellsRef,
  recordHistory,
}: UseClearHandlersArgs): UseClearHandlers {
  const handleClearAll = useCallback(() => {
    if (paintedCellsRef.current.length === 0) return;
    if (!confirm('¿Borrar TODO el scenario (pintadas de todos los pisos)? Esta acción se puede deshacer con Ctrl+Z.'))
      return;
    if (paintedCellsRef.current.length === 0) return; // re-check after confirm (raced with another tab)
    recordHistory();
    setPaintedCells([]);
    opsBuffer.pushClearAll();
    markDirty();
  }, [opsBuffer, markDirty, setPaintedCells, paintedCellsRef, recordHistory]);

  const handleClearFloor = useCallback(() => {
    const fid = activeFloor.id;
    const hasCells = paintedCellsRef.current.some((c) => c.floorId === fid);
    if (!hasCells) return;
    if (
      !confirm(`¿Borrar todas las celdas pintadas de "${activeFloor.name}"? Esta acción se puede deshacer con Ctrl+Z.`)
    )
      return;
    const stillHasCells = paintedCellsRef.current.some((c) => c.floorId === fid);
    if (!stillHasCells) return;
    recordHistory();
    setPaintedCells((prev) => prev.filter((c) => c.floorId !== fid));
    opsBuffer.pushClearFloor(fid);
    markDirty();
  }, [activeFloor.id, activeFloor.name, opsBuffer, markDirty, setPaintedCells, paintedCellsRef, recordHistory]);

  const handleClearSubdivision = useCallback(() => {
    if (!activeSubdivisionId) return;
    const fid = activeFloor.id;
    const sid = activeSubdivisionId;
    const hasCells = paintedCellsRef.current.some(
      (c) => c.floorId === fid && c.subdivisionId === sid,
    );
    if (!hasCells) return;
    const subName = activeSubdivisionName ?? activeSubdivisionId;
    if (
      !confirm(
        `¿Borrar todas las celdas pintadas de "${subName}" en "${activeFloor.name}"? Esta acción se puede deshacer con Ctrl+Z.`,
      )
    )
      return;
    const stillHasCells = paintedCellsRef.current.some(
      (c) => c.floorId === fid && c.subdivisionId === sid,
    );
    if (!stillHasCells) return;
    recordHistory();
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
    paintedCellsRef,
    recordHistory,
  ]);

  return {
    handleClearAll,
    handleClearFloor,
    handleClearSubdivision,
  };
}
