import {
  createElement,
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { getInteractiveTrait } from '@/canvas';
import type { PaintedCell, Piece } from '@/lib/shared/types';

type UseTraitMenuParams = {
  paintedCells: PaintedCell[];
  setPaintedCells: Dispatch<SetStateAction<PaintedCell[]>>;
  pieceById: Map<string, Piece>;
  markDirty: () => void;
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
}: UseTraitMenuParams) {
  const [traitMenu, setTraitMenu] = useState<TraitMenuState | null>(null);
  const open = useCallback(
    (cellId: string, traitKind: string, position: { x: number; y: number }) => {
      setTraitMenu({ cellId, traitKind, position });
    },
    [],
  );
  const close = useCallback(() => setTraitMenu(null), []);
  const change = useCallback(
    (newState: unknown) => {
      if (!traitMenu) return;
      setPaintedCells((previous) =>
        previous.map((cell) =>
          cell.id === traitMenu.cellId
            ? {
                ...cell,
                entityState: { ...cell.entityState, [traitMenu.traitKind]: newState as string },
              }
            : cell,
        ),
      );
      markDirty();
      setTraitMenu(null);
    },
    [traitMenu, setPaintedCells, markDirty],
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
