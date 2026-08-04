import type { z } from 'zod';
import type { ScenarioInputSchema, ScenarioSchema } from '@/lib/shared/schemas/scenario.schemas';
import type { CombatView } from './combat.types';
import type { Floor } from '@/lib/shared/types/floor.types';
import type { PaintedCell } from '@/lib/shared/types/paintedCell.types';

/** Full scenario as the editor sees it. */
export type Scenario = z.infer<typeof ScenarioSchema>;

/**
 * Wire shape returned by `scenarioUseCases.list()` — a flat summary used by
 * the home page to render the scenario list without loading every floor.
 * `floorCount` and `paintedCellCount` are precomputed via Prisma `_count`.
 */
export type ScenarioSummary = {
  id: string;
  name: string;
  floorCount: number;
  paintedCellCount: number;
  updatedAt: Date;
};

/**
 * Wire shape returned by `scenarioUseCases.findById({ id })`. Mirrors
 * `Scenario` minus the persisted id-bearing floor/cell nesting — only the
 * fields the editor cares about are included.
 *
 * The map dimensions (`baseCellSize`, `width`, `height`) live on the
 * scenario and are shared by every floor in it.
 */
export type LoadScenarioResult = {
  id: string;
  name: string;
  baseCellSize: number;
  width: number;
  height: number;
  floors: Floor[];
  activeFloorId: string;
  paintedCells: PaintedCell[];
  combat: CombatView | null;
};

/** Input for `scenarioUseCases.save(db, input)`. */
export type SaveScenarioInput = z.infer<typeof ScenarioInputSchema>;
