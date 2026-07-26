// Pure grid math utilities. No React, no DOM.
// All functions here are deterministic and unit-testable.

import type { Scenario } from "@/lib/shared/types";

export type GridConfig = Pick<Scenario, "baseCellSize" | "width" | "height">;

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

/** Generate the coordinates of every grid line for rendering. */
export function gridLines(cfg: GridConfig): {
  vertical: number[];
  horizontal: number[];
  totalWidth: number;
  totalHeight: number;
} {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  for (let i = 0; i <= cfg.width; i++) {
    vertical.push(i * cfg.baseCellSize);
  }
  for (let i = 0; i <= cfg.height; i++) {
    horizontal.push(i * cfg.baseCellSize);
  }
  return {
    vertical,
    horizontal,
    totalWidth: cfg.width * cfg.baseCellSize,
    totalHeight: cfg.height * cfg.baseCellSize,
  };
}
