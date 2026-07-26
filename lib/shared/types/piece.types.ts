import type { z } from "zod";
import type {
  DoorStateSchema,
  PieceCategorySchema,
  PieceSchema,
  VisualStateSchema,
} from "@/lib/shared/schemas/piece.schemas";

// The PIECE_CATEGORIES constant must mirror PieceCategorySchema exactly — it
// is the runtime iteration order used by the UI. Keeping it next to its schema
// keeps the two in lock-step.
export const PIECE_CATEGORIES = [
  "wall",
  "floor",
  "door",
  "water",
  "lava",
  "decoration",
  "other",
] as const satisfies readonly z.infer<typeof PieceCategorySchema>[];

export type PieceCategory = z.infer<typeof PieceCategorySchema>;

/** A visual state of a piece. Most pieces have just one ("default"), but
 *  objects like doors have several ("closed" | "open" | "locked"). */
export type VisualState = z.infer<typeof VisualStateSchema>;

export type DoorState = z.infer<typeof DoorStateSchema>;

/** A piece is something the GM can paint into a floor cell. See
 *  `piece.schemas.ts` for the full description and examples. */
export type Piece = z.infer<typeof PieceSchema>;

/**
 * Backwards-compat alias. Many call sites still use `Texture`; we keep the
 * name working until the rename is complete.
 * @deprecated use `Piece` instead.
 */
export type Texture = Piece;