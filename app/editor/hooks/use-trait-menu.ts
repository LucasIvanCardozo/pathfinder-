import {
  createElement,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getInteractiveTrait } from '@/canvas';
import type { PaintedCell, Piece } from '@/lib/shared/types';

type UseTraitMenuParams = {
  paintedCells: PaintedCell[];
  setPaintedCells: Dispatch<SetStateAction<PaintedCell[]>>;
  pieceById: Map<string, Piece>;
  markDirty: () => void;
  /**
   * Push a `setEntityState` op to the autosave buffer so the server
   * learns about the trait change on the next save. Receives the cell
   * id and the new entity-state map (or `null` to clear it).
   */
  pushEntityState: (
    cellId: string,
    entityState: Record<string, string | number | boolean> | null,
  ) => void;
};

type TraitMenuState = {
  cellId: string;
  traitKind: string;
  position: { x: number; y: number };
};

export function useTraitMenu({
  paintedCells,
  setPaintedCells,
  pieceById,
  markDirty,
  pushEntityState,
}: UseTraitMenuParams) {
  const [traitMenu, setTraitMenu] = useState<TraitMenuState | null>(null);
  const open = useCallback(
    (cellId: string, traitKind: string, position: { x: number; y: number }) => {
      setTraitMenu({ cellId, traitKind, position });
    },
    [],
  );
  const close = useCallback(() => setTraitMenu(null), []);
  // Mirror `paintedCells` in a ref so the `change` callback (which reads
  // it via `paintedCells.find(...)`) doesn't have to list it as a dep and
  // get recreated on every paint. Same pattern as `handlePaint` and
  // `useScenarioAutosave.save` — keeps the `render` `useMemo` stable so
  // the trait menu (when open) doesn't re-render on every stroke.
  const paintedCellsRef = useRef(paintedCells);
  paintedCellsRef.current = paintedCells;
  const change = useCallback(
    (newState: unknown) => {
      if (!traitMenu) return;
      const cellId = traitMenu.cellId;
      // Merge into the existing entityState so other trait keys (e.g. a
      // piece that has both `door-states` and `light-source` traits) survive
      // the update. We push the FULL merged state to the server so the
      // op is a self-contained replace — no merge logic on the server side.
      let mergedState: Record<string, string | number | boolean> | undefined;
      for (const cell of paintedCellsRef.current) {
        if (cell.id === cellId) {
          mergedState = { ...cell.entityState, [traitMenu.traitKind]: newState as string };
          break;
        }
      }
      if (!mergedState) return;
      setPaintedCells((previous) =>
        previous.map((cell) =>
          cell.id === cellId ? { ...cell, entityState: mergedState } : cell,
        ),
      );
      pushEntityState(cellId, mergedState);
      markDirty();
      setTraitMenu(null);
    },
    // `paintedCells` is read via `paintedCellsRef` (not the closure), so we
    // don't list it as a dep — keeps `change` (and the `render` useMemo
    // that depends on it) stable across paints.
    [traitMenu, setPaintedCells, markDirty, pushEntityState],
  );
  const render = useMemo(() => {
    if (!traitMenu) return null;
    const cell = paintedCells.find((candidate) => candidate.id === traitMenu.cellId);
    if (!cell) return null;
    const trait = getInteractiveTrait(
      pieceById.get(cell.pieceId) ?? {
        id: '',
        name: '',
        category: 'other' as const,
        visualStates: [],
        width: 0,
        height: 0,
        tags: [] as string[],
      },
    );
    if (!trait?.getMenu) return null;
    return createElement(
      'div',
      { style: { left: traitMenu.position.x, top: traitMenu.position.y, position: 'fixed' } },
      trait.getMenu({ cell, onChangeState: change, onClose: close }),
    );
  }, [traitMenu, paintedCells, pieceById, change, close]);

  return { open, close, change, render };
}
