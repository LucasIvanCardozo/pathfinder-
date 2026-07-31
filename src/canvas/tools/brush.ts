// Pure brush geometry — no React, no Konva. All functions are deterministic
// and side-effect-free so they can be unit-tested or reused by future tools.

import { DEFAULT_BRUSH_SHAPE, MAX_BRUSH_SIZE, MIN_BRUSH_SIZE } from '@/lib/shared/constants';
import type { BrushBounds, BrushCell, BrushShape, BrushSize } from './types';

export { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE };


/**
 * Round an arbitrary number up to the nearest odd value within the supported
 * range. Negative or non-finite inputs clamp to `MIN_BRUSH_SIZE`; values
 * above `MAX_BRUSH_SIZE` clamp to `MAX_BRUSH_SIZE`. Non-odd results round
 * up so the brush always keeps a unique centre cell.
 */
export function normalizeBrushSize(value: number): BrushSize {
  if (!Number.isFinite(value)) return MIN_BRUSH_SIZE;
  const clamped = Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, Math.floor(value)));
  if (clamped < MIN_BRUSH_SIZE) return MIN_BRUSH_SIZE;
  if (clamped > MAX_BRUSH_SIZE) return MAX_BRUSH_SIZE;
  return clamped % 2 === 0 ? clamped + 1 : clamped;
}

/** Step a brush size up by 2 (keeps the odd-only invariant). */
export function bumpBrushSizeUp(value: BrushSize): BrushSize {
  return normalizeBrushSize(value + 2);
}

/** Step a brush size down by 2 (keeps the odd-only invariant; floor at 1). */
export function bumpBrushSizeDown(value: BrushSize): BrushSize {
  return normalizeBrushSize(value - 2);
}

type Offset = { dx: number; dy: number };

/**
 * Cache of cell offsets for each (size, shape) combination. Computing a 9x9
 * footprint is cheap, but caching avoids re-walking the disc on every stroke
 * segment. Keyed on `${size}|${shape}` so a stroke that toggles shape in
 * between doesn't pollute the wrong footprint.
 */
const offsetCache = new Map<string, ReadonlyArray<Offset>>();

/**
 * Returns the (dx, dy) offsets from the brush centre that fall inside the
 * footprint for the requested shape:
 *   - `circle`: rounded disc via `dx² + dy² ≤ radius²` (matches the
 *     historical default; crisp edges, no fuzzy anti-aliased corners).
 *   - `square`: full odd-by-odd footprint with crisp corners; useful for
 *     fill work or when the user wants grid-aligned strokes without the
 *     rounded corners that `circle` produces.
 *
 * Default shape is `'circle'` so existing callers (and tests that don't
 * pass a shape) keep the historical behaviour.
 */
export function brushOffsets(size: BrushSize, shape: BrushShape = DEFAULT_BRUSH_SHAPE): ReadonlyArray<Offset> {
  const normalized = normalizeBrushSize(size);
  const key = `${normalized}|${shape}`;
  const cached = offsetCache.get(key);
  if (cached) return cached;
  const radius = (normalized - 1) / 2;
  const r2 = radius * radius;
  const out: Offset[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const inside =
        shape === 'circle' ? dx * dx + dy * dy <= r2 : dx * dx <= r2 && dy * dy <= r2;
      if (inside) out.push({ dx, dy });
    }
  }
  offsetCache.set(key, out);
  return out;
}

/**
 * Cells covered by the brush footprint centred at `center`. Out-of-bounds
 * cells are skipped (the brush is clipped at the map edge). The returned
 * list is de-duplicated so callers can hand it directly to React keys.
 */
export function brushCellsAt(
  center: BrushCell,
  size: BrushSize,
  bounds: BrushBounds,
  shape: BrushShape = DEFAULT_BRUSH_SHAPE,
): BrushCell[] {
  const offsets = brushOffsets(size, shape);
  const seen = new Set<string>();
  const out: BrushCell[] = [];
  for (const { dx, dy } of offsets) {
    const x = center.gridX + dx;
    const y = center.gridY + dy;
    if (x < 0 || y < 0 || x >= bounds.maxX || y >= bounds.maxY) continue;
    const key = `${x}|${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ gridX: x, gridY: y });
  }
  return out;
}

/**
 * Walk the integer grid line from `start` to `end` using Bresenham's
 * algorithm and emit every cell the line touches. Used by the stroke
 * interpolator to fill the gap between two drag samples.
 */
function iterateGridLine(start: BrushCell, end: BrushCell): Array<[number, number]> {
  let x0 = start.gridX;
  let y0 = start.gridY;
  const x1 = end.gridX;
  const y1 = end.gridY;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  // Safety cap: a Bresenham run should never exceed dx+dy+1 steps. The cap
  // guards against pathological inputs (NaN, infinity) without affecting the
  // happy path.
  const cap = dx + dy + 2;
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= cap; i++) {
    out.push([x0, y0]);
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
 * Cells painted by a stroke that starts at `start` and ends at `end`. The
 * brush footprint is stamped at every cell along the Bresenham line, then
 * the union is de-duplicated and clipped to the map bounds. This is what
 * makes fast drags look continuous instead of dotted.
 *
 * When `start` is `null` (the first sample of a drag), it falls back to a
 * single stamp at `end`.
 */
export function computeStrokeCells(
  start: BrushCell | null,
  end: BrushCell,
  size: BrushSize,
  bounds: BrushBounds,
  shape: BrushShape = DEFAULT_BRUSH_SHAPE,
): BrushCell[] {
  if (!start) return brushCellsAt(end, size, bounds, shape);
  const line = iterateGridLine(start, end);
  const offsets = brushOffsets(size, shape);
  const seen = new Set<string>();
  const out: BrushCell[] = [];
  for (const [gx, gy] of line) {
    for (const { dx, dy } of offsets) {
      const x = gx + dx;
      const y = gy + dy;
      if (x < 0 || y < 0 || x >= bounds.maxX || y >= bounds.maxY) continue;
      const key = `${x}|${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ gridX: x, gridY: y });
    }
  }
  return out;
}
