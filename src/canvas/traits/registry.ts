// Central registry of piece traits. To add a new trait:
//   1. Add the trait data type to `src/pieces/traits.ts` (with Zod schema).
//   2. Implement it in `src/canvas/traits/<kind>.ts`.
//   3. Add the entry to `traitRegistry` below.

import type { PaintedCell, Piece } from '@/lib/shared/types';
import { blocksLightTrait } from './blocks-light';
import { doorStatesTrait } from './door-states';

export type TraitMenuProps<TState> = {
  cell: PaintedCell;
  onChangeState: (newState: TState) => void;
  onClose: () => void;
};

export type TraitImpl = {
  kind: string;
  /**
   * Resolve which visualState.imagePath to render for a cell. Optional.
   * If absent, the render falls back to the piece's default visualState.
   */
  resolveTextureId?: (cell: PaintedCell, fallbackImagePath: string, piece: Piece) => string;
  defaultState?: () => unknown;
  getMenu?: ((props: TraitMenuProps<unknown>) => React.ReactNode) | null;
};

export const traitRegistry: Record<string, TraitImpl> = {
  'door-states': doorStatesTrait as unknown as TraitImpl,
  'blocks-light': blocksLightTrait as unknown as TraitImpl,
};

export type TraitKind = keyof typeof traitRegistry;

export function getTrait(kind: string): TraitImpl | undefined {
  return traitRegistry[kind];
}

export function getTextureTraits(texture: {
  traits?: readonly { kind: string }[] | undefined;
}): TraitImpl[] {
  if (!texture.traits) return [];
  const out: TraitImpl[] = [];
  for (const t of texture.traits) {
    const impl = traitRegistry[t.kind];
    if (impl) out.push(impl);
  }
  return out;
}

export function getInteractiveTrait(texture: {
  traits?: readonly { kind: string }[] | undefined;
}): TraitImpl | undefined {
  return getTextureTraits(texture).find((t) => t.getMenu);
}

/**
 * Resolves the default entity state for a piece by finding the first trait
 * that declares a `defaultState()` and mapping it to `{ [trait.kind]: state }`.
 * Returns `undefined` when the piece has no stateful traits — call sites
 * typically store the result under `PaintedCell.entityState`.
 */
export function defaultEntityStateFor(
  piece: Pick<Piece, 'traits'>,
): Record<string, unknown> | undefined {
  const traits = piece.traits ?? [];
  for (const t of traits) {
    const impl = traitRegistry[t.kind];
    if (impl?.defaultState) {
      return { [t.kind]: impl.defaultState() };
    }
  }
  return undefined;
}


