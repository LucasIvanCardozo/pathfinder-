import { z } from 'zod';
import { PIECE_LIMITS } from '@/lib/shared/constants';
import { TextureTraitSchema } from './texture-trait.schemas';

/**
 * Texture / Piece category enum. Pieces are the things the GM can paint into
 * a floor cell (walls, floors, doors, decorations, water, lava, etc.).
 *
 * The categories here are the canonical piece taxonomy; the runtime constants
 * in `piece.types.ts` must mirror this enum exactly.
 */
export const PieceCategorySchema = z.enum([
  'wall',
  'floor',
  'door',
  'water',
  'lava',
  'decoration',
  'other',
]);

/** A single visual state of a piece. Most pieces have one ("default"); doors
 *  have several ("closed", "open", "locked"). */
export const VisualStateSchema = z.object({
  id: z.string().min(1),
  imagePath: z.string().min(1),
  isDefault: z.boolean().optional(),
});

/**
 * A piece is something the GM can paint into a floor cell. It groups one or
 * more visual states under a single id/name, plus optional behaviour traits.
 *
 * Examples:
 *   { id: "floor-stone", name: "Suelo de piedra",
 *     visualStates: [{ id: "default", imagePath: ".../stone.svg" }] }
 *
 *   { id: "door", name: "Puerta",
 *     visualStates: [
 *       { id: "closed", imagePath: ".../door-closed.svg", isDefault: true },
 *       { id: "open",   imagePath: ".../door-open.svg" },
 *       { id: "locked", imagePath: ".../door-locked.svg" },
 *     ],
 *     traits: [{ kind: "door-states" }] }
 */
export const PieceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(PIECE_LIMITS.NAME_MAX),
  category: PieceCategorySchema,
  visualStates: z.array(VisualStateSchema).min(1, 'Al menos un visualState requerido'),
  width: z.number().int().min(PIECE_LIMITS.DIMENSION.MIN).max(PIECE_LIMITS.DIMENSION.MAX),
  height: z.number().int().min(PIECE_LIMITS.DIMENSION.MIN).max(PIECE_LIMITS.DIMENSION.MAX),
  tags: z.array(z.string().min(1).max(PIECE_LIMITS.TAG_MAX_LEN)).default([]),
  traits: z.array(TextureTraitSchema).optional(),
});

export const DoorStateSchema = z.enum(['open', 'closed', 'locked']);
