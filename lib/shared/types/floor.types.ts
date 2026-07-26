import type { z } from "zod";
import type { FloorSchema } from "@/lib/shared/schemas/floor.schemas";

/** A single floor inside a scenario. */
export type Floor = z.infer<typeof FloorSchema>;

/**
 * Default floor set for brand-new scenarios. Subsuelo 1 (basement),
 * Planta Baja (ground floor), Piso 1 (first floor above ground).
 *
 * Each floor starts as a 20×15 grid with 64px base cell size — same as
 * `EditorClient`'s `fallbackFloor`, so the editor behaves identically
 * whether floors came from a fresh scenario or from a degraded state.
 *
 * `id` is an empty placeholder; the repository layer assigns real ids via
 * `generateId("floor")` at insert time.
 */
export const DEFAULT_FLOORS: Floor[] = [
  { id: "", name: "Subsuelo 1", baseCellSize: 64, width: 20, height: 15 },
  { id: "", name: "Planta Baja", baseCellSize: 64, width: 20, height: 15 },
  { id: "", name: "Piso 1", baseCellSize: 64, width: 20, height: 15 },
];