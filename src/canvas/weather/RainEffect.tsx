'use client';

import { useCallback, useRef } from 'react';
import overlayStyles from './weather-effect.module.css';
import { useCanvasOverlay } from './useCanvasOverlay';

type Drop = { x: number; y: number; speed: number; length: number };

/** Diagonal rain with a slight wind component; pool reseeded on resize
 *  so particle density tracks the actual canvas area. */
export function RainEffect() {
  const stateRef = useRef<{ drops: Drop[]; w: number }>({ drops: [], w: -1 });
  const draw = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      const state = stateRef.current;
      if (state.w !== width) {
        state.drops = seedDrops(width, height);
        state.w = width;
      }
      drawRain(ctx, width, height, state.drops);
    },
    [],
  );
  const canvasRef = useCanvasOverlay({ draw });
  return <canvas ref={canvasRef} className={overlayStyles.overlay} tabIndex={-1} aria-hidden="true" />;
}

function seedDrops(width: number, height: number): Drop[] {
  const count = Math.min(400, Math.floor((width * height) / 6000));
  return Array.from({ length: count }, () => makeDrop(width, height, true));
}

function makeDrop(w: number, h: number, initial = false): Drop {
  return { x: Math.random() * w, y: initial ? Math.random() * h : -10, speed: 8 + Math.random() * 10, length: 10 + Math.random() * 14 };
}

function drawRain(ctx: CanvasRenderingContext2D, width: number, height: number, drops: Drop[]): void {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(180, 200, 220, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i]!;
    d.y += d.speed;
    d.x += d.speed * 0.15; // slight wind
    if (d.y - d.length > height) {
      drops[i] = makeDrop(width, height);
      continue;
    }
    if (d.x > width) d.x = 0;
    ctx.moveTo(d.x, d.y - d.length);
    ctx.lineTo(d.x - d.length * 0.15, d.y);
  }
  ctx.stroke();
}
