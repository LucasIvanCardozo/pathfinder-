import { z } from 'zod';

/**
 * A painted cell represents one cell of one subdivision that has a piece
 * applied. Empty cells are not stored.
 */
export const PaintedCellSchema = z.object({
  id: z.string().min(1),
  floorId: z.string().min(1),
  subdivisionId: z.string().min(1),
  gridX: z.number().int(),
  gridY: z.number().int(),
  pieceId: z.string().min(1),
  /**
   * Mutable state attached to this cell by its piece's traits. Keys are
   * trait kinds (e.g. "door-states" → "closed" | "open" | "locked").
   */
  entityState: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
