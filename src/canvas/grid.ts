// Pure grid math utilities. No React, no Konva dependency.
// All functions here are deterministic and unit-testable.

/**
 * World-space grid configuration. The grid represents the world's cell
 * boundaries — its line spacing is `worldBaseCellSize * zoom`, which is the
 * same formula the renderer uses for painted cells. The grid stays aligned
 * with the world's grid at every zoom level.
 */
export type GridConfig = {
  /** Cell size in world pixels (e.g., 64). */
  worldBaseCellSize: number;
  /** Display zoom multiplier. 1 = native (1 world pixel = 1 display pixel). */
  zoom: number;
  /** World size in cells, horizontal axis. */
  width: number;
  /** World size in cells, vertical axis. */
  height: number;
};

/** Convert a pixel coordinate to a grid cell index (floored). */
export function worldToGrid(value: number, cellSize: number): number {
  return Math.floor(value / cellSize);
}

/** Convert a grid cell index to a pixel coordinate. */
export function gridToWorld(gridValue: number, cellSize: number): number {
  return gridValue * cellSize;
}

/** Snap a pixel coordinate to the nearest grid line. */
export function snapToGrid(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize;
}

/** Snap a 2D position to the nearest grid cell origin. */
export function snapToGridVec(
  pos: { x: number; y: number },
  cellSize: number,
): { x: number; y: number } {
  return {
    x: snapToGrid(pos.x, cellSize),
    y: snapToGrid(pos.y, cellSize),
  };
}

/** Snap a pixel coordinate to the nearest grid cell index (rounded). */
export function snapToGridCell(value: number, cellSize: number): number {
  return Math.round(value / cellSize);
}

/**
 * Generate the line positions for the world grid overlay. Lines are at every
 * `worldBaseCellSize * zoom` pixels, starting from the top-left corner of the
 * world. With `zoom = 1` the grid aligns 1:1 with the world's cells; at other
 * zooms it scales proportionally and stays aligned.
 */
export function gridLines(cfg: GridConfig): {
  vertical: number[];
  horizontal: number[];
  spacing: number;
} {
  const spacing = cfg.worldBaseCellSize * cfg.zoom;
  const vertical: number[] = [];
  const horizontal: number[] = [];
  for (let i = 0; i <= cfg.width; i++) {
    vertical.push(i * spacing);
  }
  for (let i = 0; i <= cfg.height; i++) {
    horizontal.push(i * spacing);
  }
  return { vertical, horizontal, spacing };
}