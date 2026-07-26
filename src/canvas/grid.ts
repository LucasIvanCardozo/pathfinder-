// Pure grid math utilities. No React, no Konva dependency.
// All functions here are deterministic and unit-testable.

/**
 * World-space grid configuration. The grid represents the world's cell
 * boundaries — its line spacing is `worldBaseCellSize`. The Stage applies
 * the display zoom as a transform, so lines are positioned in world coords
 * (not display coords) and Konva scales them.
 *
 * If `worldBounds` is provided, only lines within that world-coord rect
 * are generated. This is the viewport-culling path used by the renderer.
 */
export type GridConfig = {
  /** Cell size in world pixels (e.g., 64). */
  worldBaseCellSize: number;
  /** World size in cells, horizontal axis. */
  width: number;
  /** World size in cells, vertical axis. */
  height: number;
  /** Optional world-coord rect for visibility culling. */
  worldBounds?: { x: number; y: number; width: number; height: number };
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
 * Generate the line positions for the world grid overlay, in world
 * coordinates. Lines are at every `worldBaseCellSize` pixels, starting from
 * the top-left corner of the world.
 *
 * If `worldBounds` is provided, lines outside that rect are skipped. The
 * Stage's zoom transform scales them into display pixels; the bounds are
 * in world coords, so divide the display viewport by zoom to get them.
 */
export function gridLines(cfg: GridConfig): {
  vertical: number[];
  horizontal: number[];
} {
  const { worldBaseCellSize, width, height, worldBounds } = cfg;
  const startX = worldBounds
    ? Math.max(0, Math.floor(worldBounds.x / worldBaseCellSize))
    : 0;
  const endX = worldBounds
    ? Math.min(width, Math.ceil((worldBounds.x + worldBounds.width) / worldBaseCellSize))
    : width;
  const startY = worldBounds
    ? Math.max(0, Math.floor(worldBounds.y / worldBaseCellSize))
    : 0;
  const endY = worldBounds
    ? Math.min(height, Math.ceil((worldBounds.y + worldBounds.height) / worldBaseCellSize))
    : height;
  const vertical: number[] = [];
  const horizontal: number[] = [];
  for (let i = startX; i <= endX; i++) {
    vertical.push(i * worldBaseCellSize);
  }
  for (let i = startY; i <= endY; i++) {
    horizontal.push(i * worldBaseCellSize);
  }
  return { vertical, horizontal };
}