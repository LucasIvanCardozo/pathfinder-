// Central registry of piece traits. To add a new trait:
//   1. Add the trait data type to `src/pieces/traits.ts` (with Zod schema).
//   2. Implement it in `src/canvas/traits/<kind>.ts`.
//   3. Add the entry to `traitRegistry` below.

import type { PaintedCell, Piece } from "@/pieces";
import { doorStatesTrait, type DoorState } from "./door-states";
import { blocksLightTrait } from "./blocks-light";

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
  validateState?: (raw: unknown) => unknown;
  defaultState?: () => unknown;
  getMenu?: ((props: TraitMenuProps<unknown>) => React.ReactNode) | null;
  labelFor?: (state: string) => string;
};

export const traitRegistry: Record<string, TraitImpl> = {
  "door-states": doorStatesTrait as unknown as TraitImpl,
  "blocks-light": blocksLightTrait as unknown as TraitImpl,
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

export type { DoorState };