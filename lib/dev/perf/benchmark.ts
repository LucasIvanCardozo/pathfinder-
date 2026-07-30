/**
 * Dev-only benchmark scenarios. Each scenario is a pure async function that
 * drives the editor through a synthetic workload (paint, pan, drag) via
 * dispatch callbacks supplied by the panel. The benchmark emits status
 * messages back to the panel through `ctx.emit` and respects `ctx.signal` for
 * cooperative cancellation.
 *
 * Dev-only gate: the entire module is exported; the panel that consumes these
 * scenarios is itself dev-only. The dispatch fns provided by the caller are
 * expected to call `telemetry.recordEvent` so the counters reflect the
 * workload.
 */
import type { telemetry } from './telemetry';

export type ScenarioCtx = {
  telemetry: typeof telemetry;
  signal: AbortSignal;
  emit: (msg: string) => void;
};

export type Scenario = {
  name: string;
  description: string;
  fn: (ctx: ScenarioCtx) => Promise<void>;
};

const PAINT_GAP_MS = 16; // ~60 paints/sec
const PAN_GAP_MS = 16;
const DEFAULT_PAINT_CELLS = 200;
const DEFAULT_PAN_DURATION_MS = 3000;
const DEFAULT_DRAG_STEPS = 100;

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

type DispatchPaint = (
  floorId: string,
  subdivisionId: string,
  cells: { gridX: number; gridY: number }[],
  pieceId: string | null,
) => void;

type DispatchPan = (dx: number, dy: number) => void;

type DispatchDrag = (pieceId: string, steps: number) => void;

type GetValidPaintTarget = () => {
  floorId: string;
  subdivisionId: string;
  pieceId: string | null;
  bounds: { w: number; h: number };
} | null;

const paintStress: Scenario = {
  name: 'paint-stress',
  description: `Trigger ${DEFAULT_PAINT_CELLS} paint strokes with random cells.`,
  async fn(ctx: ScenarioCtx): Promise<void> {
    const dispatchPaint = (ctx as unknown as { dispatchPaint: DispatchPaint }).dispatchPaint;
    const getValidPaintTarget = (ctx as unknown as { getValidPaintTarget: GetValidPaintTarget })
      .getValidPaintTarget;
    if (!dispatchPaint || !getValidPaintTarget) {
      ctx.emit('paint-stress: missing dispatchPaint or getValidPaintTarget');
      return;
    }
    const target = getValidPaintTarget();
    if (!target) {
      ctx.emit('paint-stress: no valid paint target');
      return;
    }
    ctx.emit(`paint-stress: painting ${DEFAULT_PAINT_CELLS} strokes on ${target.floorId}`);
    for (let i = 0; i < DEFAULT_PAINT_CELLS; i++) {
      if (ctx.signal.aborted) return;
      const cellCount = 1 + Math.floor(Math.random() * 4);
      const cells = Array.from({ length: cellCount }, () => ({
        gridX: Math.floor(Math.random() * target.bounds.w),
        gridY: Math.floor(Math.random() * target.bounds.h),
      }));
      dispatchPaint(target.floorId, target.subdivisionId, cells, target.pieceId);
      // Yield to the event loop without busy-looping.
      // eslint-disable-next-line no-await-in-loop
      await sleep(PAINT_GAP_MS, ctx.signal);
    }
    ctx.emit('paint-stress: done');
  },
};

const panStress: Scenario = {
  name: 'pan-stress',
  description: `Pan for ${DEFAULT_PAN_DURATION_MS}ms at ~60fps.`,
  async fn(ctx: ScenarioCtx): Promise<void> {
    const dispatchPan = (ctx as unknown as { dispatchPan: DispatchPan }).dispatchPan;
    if (!dispatchPan) {
      ctx.emit('pan-stress: missing dispatchPan');
      return;
    }
    ctx.emit(`pan-stress: panning for ${DEFAULT_PAN_DURATION_MS}ms`);
    const startedAt = performance.now();
    let t = 0;
    while (performance.now() - startedAt < DEFAULT_PAN_DURATION_MS) {
      if (ctx.signal.aborted) return;
      const dx = Math.sin(t * 0.05) * 8;
      const dy = Math.cos(t * 0.05) * 8;
      dispatchPan(dx, dy);
      t += 1;
      // eslint-disable-next-line no-await-in-loop
      await sleep(PAN_GAP_MS, ctx.signal);
    }
    ctx.emit('pan-stress: done');
  },
};

const dragPiece: Scenario = {
  name: 'drag-piece',
  description: `Drag a piece for ${DEFAULT_DRAG_STEPS} steps.`,
  async fn(ctx: ScenarioCtx): Promise<void> {
    const dispatchDrag = (ctx as unknown as { dispatchDrag: DispatchDrag }).dispatchDrag;
    const getRandomPieceId = (ctx as unknown as { getRandomPieceId: () => string | null })
      .getRandomPieceId;
    if (!dispatchDrag || !getRandomPieceId) {
      ctx.emit('drag-piece: missing dispatchDrag or getRandomPieceId');
      return;
    }
    const pieceId = getRandomPieceId();
    if (!pieceId) {
      ctx.emit('drag-piece: no piece available');
      return;
    }
    ctx.emit(`drag-piece: dragging ${pieceId} for ${DEFAULT_DRAG_STEPS} steps`);
    dispatchDrag(pieceId, DEFAULT_DRAG_STEPS);
    ctx.emit('drag-piece: done');
  },
};

export function exportScenarios(): Scenario[] {
  return [paintStress, panStress, dragPiece];
}

/**
 * Runs a single scenario with the supplied dispatch callbacks. The dispatch
 * fns are attached to the `ctx` object so the scenarios can stay decoupled
 * from React state. Throws if `signal` is already aborted.
 */
export async function runScenario(
  scenario: Scenario,
  ctx: ScenarioCtx & {
    dispatchPaint: DispatchPaint;
    dispatchPan: DispatchPan;
    dispatchDrag: DispatchDrag;
    getValidPaintTarget: GetValidPaintTarget;
    getRandomPieceId: () => string | null;
  },
): Promise<void> {
  if (ctx.signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  await scenario.fn(ctx);
}
