/**
 * Canonical subdivision set. Subdivisions are an immutable hardcoded
 * configuration — every floor in every scenario shares this set. IDs are
 * stable string literals so they survive `pnpm db:pr:reset` and are the
 * same on every deployment.
 *
 * `cellSizeRatio` controls how granular the layer's grid is (ratio 6 has
 * 36x more cells per floor cell than ratio 1). `order` controls the Z-stack
 * — `FloorCanvas` renders one Konva Layer per subdivision in `order` asc.
 */
import type { SubdivisionConfig } from '@/lib/shared/types/subdivision.types';

export const SUBDIVISIONS: readonly SubdivisionConfig[] = Object.freeze([
  { id: 'suelo', name: 'Suelo', cellSizeRatio: 1, order: 0 },
  { id: 'objetos-grandes', name: 'Objetos grandes', cellSizeRatio: 2, order: 1 },
  { id: 'objetos-pequenos', name: 'Objetos pequeños', cellSizeRatio: 4, order: 2 },
  { id: 'estructuras', name: 'Estructuras', cellSizeRatio: 1, order: 3 },
]);