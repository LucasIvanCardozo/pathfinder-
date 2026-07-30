import { z } from 'zod';

/**
 * Schema for a subdivision config. Used by `lib/shared/types/subdivision.types.ts`
 * to derive the `SubdivisionConfig` type. Subdivisions are an immutable
 * hardcoded set in production — the runtime validator is kept here so the
 * shape stays a single source of truth and accidental drift between type
 * and constant surfaces at the boundary.
 */
export const SubdivisionConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  cellSizeRatio: z.number().int().min(1).max(64),
  order: z.number().int().min(0).max(20),
});