/**
 * Map-level constants. The world has a fixed size in cells; the editor
 * renders it scaled by the current `zoom` multiplier (see `EditorClient`).
 *
 * Map dimensions live on the scenario — every floor in a scenario shares
 * the same `(baseCellSize, width, height)` triple. These constants drive
 * both the default scenario size and the editor's zoom bounds.
 */

/** World size in cells, horizontal axis. */
export const MAP_WORLD_WIDTH = 100;

/** World size in cells, vertical axis. */
export const MAP_WORLD_HEIGHT = 100;

/** Default world cell size in pixels. Persisted on each scenario as
 *  `baseCellSize`; the editor can change it per-scenario later. */
export const DEFAULT_BASE_CELL_SIZE = 64;

/** Display zoom lower bound. At `MIN_ZOOM` the map is shown at 25% of its
 *  native pixel size. */
export const MIN_ZOOM = 0.3;

/** Display zoom upper bound. At `MAX_ZOOM` the map is shown at 400% of its
 *  native pixel size. */
export const MAX_ZOOM = 1.5;

/** Linear zoom step applied by each `−` / `+` button click in the header.
 *  0.1 means each click moves the displayed size by 10% of full scale
 *  (100% → 90% → 80% … on `−`, 100% → 110% → 120% … on `+`). */
export const ZOOM_STEP = 0.05;

/** Convenience shape passed to `scenarioUseCases.createBlank` and to
 *  `FloorStack` as the `mapDims` prop. */
export type MapDims = {
  baseCellSize: number;
  width: number;
  height: number;
};

/** The default map configuration for brand-new scenarios. */
export const DEFAULT_MAP_DIMS: MapDims = {
  baseCellSize: DEFAULT_BASE_CELL_SIZE,
  width: MAP_WORLD_WIDTH,
  height: MAP_WORLD_HEIGHT,
};

/**
 * Game rule (Pathfinder TTRPG): one base cell = 5 ft. Effect footprints use
 * feet as their primary unit (`widthFt` / `depthFt` on the wire); the canvas
 * converts to grid cells with `widthFt * cellSizeRatio / FEET_PER_BASE_CELL`.
 * For ratio=1 subdivisions (suelo, estructuras, obscured) this is the
 * intuitive `widthFt / 5`; for ratio=2 (objetos-grandes) and ratio=4
 * (objetos-pequenos) the per-subdivision cell is correspondingly smaller.
 */
export const FEET_PER_BASE_CELL = 5;
