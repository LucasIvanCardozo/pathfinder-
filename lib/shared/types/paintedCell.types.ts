import type { z } from 'zod';
import type { PaintedCellSchema } from '@/lib/shared/schemas/paintedCell.schemas';

/**
 * A painted cell represents one cell of one subdivision that has a piece
 * applied. Empty cells are not stored.
 */
export type PaintedCell = z.infer<typeof PaintedCellSchema>;
