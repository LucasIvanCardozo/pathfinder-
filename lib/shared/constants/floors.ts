/**
 * Default floor configuration for brand-new scenarios. Order matters: index 0
 * is the lowest floor ("Subsuelo 1"), then "Planta Baja" (the ground-level
 * floor the editor starts on), then "Piso 1" (above ground).
 *
 * Floors get real ids assigned at insert time via `newId('floor')`. This
 * module only carries the canonical display names so the seed payload, the
 * default-scenario creation use case, and the editor header's floor tabs all
 * agree on what to call each level.
 */
export const DEFAULT_FLOOR_NAMES: readonly string[] = Object.freeze([
  'Subsuelo 1',
  'Planta Baja',
  'Piso 1',
]);