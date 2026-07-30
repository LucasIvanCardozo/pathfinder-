'use client';

import type { PaintedCell, Piece } from '@/lib/shared/types';
import { StateMenu } from './StateMenu';

export const DOOR_STATES = ['closed', 'open', 'locked'] as const;
export type DoorState = (typeof DOOR_STATES)[number];

const DOOR_LABELS: Record<DoorState, string> = {
  closed: 'Cerrada',
  open: 'Abierta',
  locked: 'Bloqueada',
};

export const doorStatesTrait = {
  kind: 'door-states' as const,

  defaultState(): DoorState {
    return 'closed';
  },

  /**
   * Resolve the imagePath to render for a cell. Looks at `cell.entityState`
   * and finds the matching visualState in the piece. Falls back to the
   * default visualState if the state is missing/invalid.
   */
  resolveTextureId(cell: PaintedCell, fallbackImagePath: string, piece: Piece): string {
    const state = cell.entityState?.['door-states'] as DoorState | undefined;
    const visualState = state
      ? piece.visualStates.find((v) => v.id === state)
      : (piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0]);
    return visualState?.imagePath ?? fallbackImagePath;
  },

  getMenu({
    cell,
    onChangeState,
    onClose,
  }: {
    cell: PaintedCell;
    onChangeState: (newState: DoorState) => void;
    onClose: () => void;
  }) {
    const current = (cell.entityState?.['door-states'] as DoorState) ?? this.defaultState();
    return (
      <StateMenu
        title="Puerta"
        states={DOOR_STATES}
        labels={DOOR_LABELS as unknown as Record<string, string>}
        current={current}
        onChange={(s) => onChangeState(s as DoorState)}
        onClose={onClose}
      />
    );
  },
};

export type DoorStatesTrait = typeof doorStatesTrait;
