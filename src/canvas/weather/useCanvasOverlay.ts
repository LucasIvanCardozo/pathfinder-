'use client';

import { useEffect, useRef } from 'react';

export type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  /** Elapsed seconds since the hook mounted, monotonic. */
  time: number;
};

/** Reserved sync signal — optional ref/object the draw callback can read
 *  (e.g. a thunder-flash timestamp held by the consumer). Current consumers
 *  capture their own sync refs via closure instead, so the hook only stores
 *  the value for documentation. */
export type ExternalSync = { flash?: boolean; flashAt?: number };

type Args = {
  draw: (args: DrawArgs) => void;
  externalSync?: { readonly current: ExternalSync | null };
};

/**
 * Owns the boilerplate every weather/animation effect used to repeat: canvas
 * ref, DPR-aware resize, `ResizeObserver` against the parent, and a
 * `requestAnimationFrame` tick. The `draw` callback runs each frame with the
 * live `{ ctx, width, height, dpr, time }` tuple — the effect file only owns
 * particle initialisation + the per-frame drawing body.
 *
 * Consumers should pass a `useCallback`-stable `draw` (closures over their
 * particle pools are typical) so the loop's effect deps stay narrow.
 */
export function useCanvasOverlay(args: Args): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Surface the ref through `useEffect`'s closure pattern: capture the latest
  // `draw` in a ref so the loop can read it without re-binding the effect,
  // which would cancel/recreate the RAF cycle on every render.
  const drawRef = useRef(args.draw);
  drawRef.current = args.draw;
  // External sync ref is captured here for completeness; current consumers
  // don't read it through the hook so it's intentionally a no-op for now.
  // Kept in the signature so future effects (audio-driven flashes, etc.)
  // have a documented hook for sync state.
  void args.externalSync;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const startTime = performance.now();

    let width = 0;
    let height = 0;
    let raf = 0;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const tick = () => {
      const time = (performance.now() - startTime) / 1000;
      drawRef.current({ ctx, width, height, dpr, time });
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    resize();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return canvasRef;
}
