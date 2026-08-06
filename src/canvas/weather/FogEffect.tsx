'use client';

import { useCallback, useRef } from 'react';
import { useCanvasOverlay } from './useCanvasOverlay';
import overlayStyles from './weather-effect.module.css';

type Wisp = {
  x: number;
  baseY: number;
  r: number;
  vx: number;
  ampY: number;
  freqY: number;
  phaseY: number;
  alpha: number;
  y: number;
};

/** Translucent fog. Far wisps (~40%): large, slow, sparse. Near wisps
 *  (~60%): smaller, faster, denser. Vertical bob is sinusoidal around
 *  `baseY`. `globalCompositeOperation = 'lighter'` so overlaps accumulate
 *  into haze rather than sheet of paint. */
export function FogEffect() {
  const stateRef = useRef<{ wisps: Wisp[]; w: number }>({ wisps: [], w: -1 });
  const draw = useCallback(
    ({
      ctx,
      width,
      height,
      time,
    }: {
      ctx: CanvasRenderingContext2D;
      width: number;
      height: number;
      time: number;
    }) => {
      const state = stateRef.current;
      if (state.w !== width) {
        state.wisps = seedWisps(width, height);
        state.w = width;
      }
      drawFog(ctx, width, height, state.wisps, time);
    },
    [],
  );
  const canvasRef = useCanvasOverlay({ draw });
  return (
    <canvas ref={canvasRef} className={overlayStyles.overlay} tabIndex={-1} aria-hidden="true" />
  );
}

function seedWisps(width: number, height: number): Wisp[] {
  const count = Math.min(40, Math.max(14, Math.floor((width * height) / 18_000)));
  return Array.from({ length: count }, (_, i) => {
    const isFar = i % 5 < 2; // ~40% far, 60% near
    const baseY = Math.random() * height;
    const r = isFar ? 180 + Math.random() * 140 : 80 + Math.random() * 100;
    return {
      x: Math.random() * width,
      baseY,
      r,
      vx: isFar ? 0.08 + Math.random() * 0.18 : 0.25 + Math.random() * 0.5,
      ampY: isFar ? 6 + Math.random() * 10 : 12 + Math.random() * 20,
      freqY: 0.002 + Math.random() * 0.004,
      phaseY: Math.random() * Math.PI * 2,
      alpha: isFar ? 0.08 + Math.random() * 0.1 : 0.18 + Math.random() * 0.18,
      y: baseY,
    };
  });
}

function drawFog(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  wisps: Wisp[],
  time: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < wisps.length; i++) {
    const w = wisps[i]!;
    w.x += w.vx;
    w.y = w.baseY + Math.sin(time * w.freqY + w.phaseY) * w.ampY;
    if (w.x - w.r > width) w.x = -w.r;
    if (w.y - w.r > height) w.y = -w.r;
    if (w.y + w.r < 0) w.y = height + w.r;
    const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
    grad.addColorStop(0, `rgba(232, 236, 244, ${w.alpha})`);
    grad.addColorStop(1, 'rgba(232, 236, 244, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
