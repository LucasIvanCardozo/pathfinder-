// Wall-aware footprint filter used by paint, erase, darkness erase, and
// spell markers. The brush footprint normally covers every cell in its
// disc/square, but the user wants painted structures (`subdivisionId ===
// 'estructuras'`) to act as opaque walls — light does not bend around them.
// Pure function so it can be unit-tested without React/Konva.

import type { BrushCell } from './types';

/**
 * Bresenham 8-connected line from `start` to `end`, inclusive of both endpoints.
 * Used by `clipFootprintByWalls` to ray-cast from the brush centre to each cell
 * in the footprint. Bresenham 8-connected (vs 4-connected) keeps the line close
 * to the geometric straight between the two points, which matches what the
 * user mentally pictures as "the ray from the cursor".
 */
function bresenhamLine(start: BrushCell, end: BrushCell): BrushCell[] {
  const out: BrushCell[] = [];
  let x0 = start.gridX;
  let y0 = start.gridY;
  const x1 = end.gridX;
  const y1 = end.gridY;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  // Safety cap: a Bresenham run never exceeds max(dx, dy) + 1 steps. The cap
  // guards against pathological inputs (NaN, infinity) without affecting the
  // happy path.
  const cap = Math.max(dx, dy) + 2;
  for (let i = 0; i <= cap; i++) {
    out.push({ gridX: x0, gridY: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

/**
 * Cells of the brush `footprint` reachable from `center` without crossing a
 * wall, given the predicate `isWall`. Ray-casts from `center` to each
 * footprint cell along the Bresenham 8-connected line and applies two rules:
 *
 * - A footprint cell is **reachable** iff the line from the centre to that cell
 *   does not pass through any wall. Light does not bend around corners: if the
 *   straight ray crosses a wall, the cell behind it stays hidden. This is the
 *   property the user asked for — walls are opaque even when the user clicks
 *   on a different cell and the BFS could otherwise route around a gap.
 * - Walls reveal themselves. If `target` is itself a wall, it is included in
 *   the output as long as the line does not pass through a *different* wall on
 *   the way. (If a wall sits between the centre and another wall, the far wall
 *   is hidden — physically: light cannot pass through one wall to reveal
 *   another.)
 *
 * The centre is exempt from the "line crosses a wall" check (it is the ray's
 * origin). The Bresenham line is walked from index 1 to length-2 inclusive so
 * neither the centre nor the target is treated as a blocking intermediate.
 *
 * Special case: when the **centre itself sits on a wall**, only the centre
 * reaches the output. The ray "originates inside" the wall and the wall
 * blocks it in every direction, so no neighbour can be reached. This matches
 * the physical intuition that a light source embedded in an opaque material
 * cannot illuminate its surroundings.
 *
 * Used by:
 * - paint and erase tool strokes (via `usePaintStroke`): the brush cannot
 *   paint or erase across a structure wall.
 * - darkness erase (`handleDarknessErase`): the brush acts as a light source.
 * - spell markers (`useEffectMarkers`) and the spell preview (`FloorCanvas`).
 * - the brush preview when the tool is paint, erase, or darkness-erase.
 *
 * `isWall` is injected instead of taking the painted-cells array so this layer
 * stays free of React state and can be reused for any future wall-like rule.
 */
export function clipFootprintByWalls(
  center: BrushCell,
  footprint: readonly BrushCell[],
  isWall: (x: number, y: number) => boolean,
): BrushCell[] {
  const centerIsWall = isWall(center.gridX, center.gridY);
  const out: BrushCell[] = [];
  for (const target of footprint) {
    if (target.gridX === center.gridX && target.gridY === center.gridY) {
      // Centre cell is always reachable from itself.
      out.push(target);
      continue;
    }
    // When the centre sits on a wall, no other cell in the footprint is
    // reachable: the ray originates inside the wall and the wall blocks it
    // from escaping in every direction.
    if (centerIsWall) continue;

    const line = bresenhamLine(center, target);
    let blocked = false;
    for (let i = 1; i < line.length - 1; i++) {
      const cell = line[i];
      if (cell && isWall(cell.gridX, cell.gridY)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) out.push(target);
  }
  return out;
}
