import type { z } from "zod";
import type { FloorSchema } from "@/lib/shared/schemas/floor.schemas";

/**
 * A single floor inside a scenario. Carries only its identity and display
 * name; map dimensions (`baseCellSize`, `width`, `height`) belong to the
 * parent `Scenario` so all floors in a scenario always share them.
 */
export type Floor = z.infer<typeof FloorSchema>;

/**
 * Default floor names for brand-new scenarios. The map dimensions come from
 * the scenario-level constants in `lib/shared/constants/map.ts`; floors
 * inherit them automatically.
 *
 * `id` is an empty placeholder; the repository assigns real ids via
 * `generateId("floor")` at insert time.
 */
export const DEFAULT_FLOORS: Floor[] = [
  { id: "", name: "Subsuelo 1" },
  { id: "", name: "Planta Baja" },
  { id: "", name: "Piso 1" },
];