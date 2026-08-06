'use client';

import { useCallback, useRef } from 'react';
import { useCanvasOverlay } from './useCanvasOverlay';
import overlayStyles from './weather-effect.module.css';

type Flake = { x: number; y: number; r: number; vy: number; swing: number; phase: number };

/** Slow-falling snowflakes, soft white dots with subtle side-swing.
 *  Pool reseeded on width change so density tracks the canvas area. */
export function SnowEffect() {
  const stateRef = useRef<{ flakes: Flake[]; w: number }>({ flakes: [], w: -1 });
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
        state.flakes = seedFlakes(width, height);
        state.w = width;
      }
      drawSnow(ctx, width, height, state.flakes, time);
    },
    [],
  );
  const canvasRef = useCanvasOverlay({ draw });
  return (
    <canvas ref={canvasRef} className={overlayStyles.overlay} tabIndex={-1} aria-hidden="true" />
  );
}

function seedFlakes(width: number, height: number): Flake[] {
  const count = Math.min(220, Math.max(60, Math.floor((width * height) / 8000)));
  return Array.from({ length: count }, () => makeFlake(width, height, true));
}

function makeFlake(w: number, h: number, initial = false): Flake {
  return {
    x: Math.random() * w,
    y: initial ? Math.random() * h : -10,
    r: 1.2 + Math.random() * 2.4,
    vy: 0.5 + Math.random() * 1.2,
    swing: 0.4 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
  };
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  flakes: Flake[],
  time: number,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(245, 248, 255, 0.85)';
  for (let i = 0; i < flakes.length; i++) {
    const f = flakes[i]!;
    f.y += f.vy;
    f.x += Math.sin(time * 0.02 + f.phase) * f.swing * 0.3;
    if (f.y - f.r > height) {
      flakes[i] = makeFlake(width, height);
      continue;
    }
    if (f.x < -10) f.x = width + 10;
    if (f.x > width + 10) f.x = -10;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
