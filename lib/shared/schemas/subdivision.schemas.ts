import { z } from 'zod';
import { SUBDIVISION_LIMITS } from '@/lib/shared/constants';

/**
 * Schema for a subdivision config. Used by `lib/shared/types/subdivision.types.ts`
 * to derive the `SubdivisionConfig` type. Subdivisions are an immutable
 * hardcoded set in production — the runtime validator is kept here so the
 * shape stays a single source of truth and accidental drift between type
 * and constant surfaces at the boundary.
 */
export const SubdivisionConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(SUBDIVISION_LIMITS.NAME_MAX),
  cellSizeRatio: z
    .number()
    .int()
    .min(SUBDIVISION_LIMITS.CELL_SIZE_RATIO.MIN)
    .max(SUBDIVISION_LIMITS.CELL_SIZE_RATIO.MAX),
  order: z.number().int().min(SUBDIVISION_LIMITS.ORDER.MIN).max(SUBDIVISION_LIMITS.ORDER.MAX),
  /** When false, the subdivision is hidden from paint tabs and numeric
   *  shortcuts. Used for special-purpose layers like darkness. Defaults to
   *  true when omitted. */
  paintable: z.boolean().optional(),
});
