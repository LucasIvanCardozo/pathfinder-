'use client';

import { useCallback, useEffect, useRef } from 'react';
import { STORM_TIMING } from '@/lib/shared/constants';
import overlayStyles from './weather-effect.module.css';
import { useCanvasOverlay } from './useCanvasOverlay';

type Drop = { x: number; y: number; speed: number; length: number };

type Props = {
  /** Timestamp (ms) of the most recent thunder trigger. New value → brief
   *  lightning flash. `null` if no thunder has been heard yet. */
  thunderAt: number | null;
};

/** Storm canvas overlay — diagonal drops + lightning flashes synced to
 *  `thunderAt`. Flash is a two-stage pulse (full → gap → medium) tuned
 *  to ~250ms total; reads `flashStartRef.current` each frame so visuals
 *  stay locked to the audio schedule. */
export function StormEffect({ thunderAt }: Props) {
  const flashStartRef = useRef<number | null>(null);
  const stateRef = useRef<{ drops: Drop[]; w: number }>({ drops: [], w: -1 });
  const draw = useCallback(
    ({ ctx, width, height }: { ctx: CanvasRenderingContext2D; width: number; height: number }) => {
      const state = stateRef.current;
      if (state.w !== width) {
        state.drops = seedDrops(width, height);
        state.w = width;
      }
      drawStorm(ctx, width, height, state.drops, flashStartRef);
    },
    [],
  );
  const canvasRef = useCanvasOverlay({ draw });

  // Sync external thunder trigger into the loop's flash state.
  useEffect(() => {
    if (thunderAt === null) return;
    flashStartRef.current = performance.now();
  }, [thunderAt]);

  return <canvas ref={canvasRef} className={overlayStyles.overlay} tabIndex={-1} aria-hidden="true" />;
}

function seedDrops(width: number, height: number): Drop[] {
  const count = Math.min(450, Math.floor((width * height) / 5_000));
  return Array.from({ length: count }, () => makeDrop(width, height, true));
}

function makeDrop(w: number, h: number, initial = false): Drop {
  return { x: Math.random() * w, y: initial ? Math.random() * h : -10, speed: 9 + Math.random() * 11, length: 12 + Math.random() * 14 };
}

function drawStorm(ctx: CanvasRenderingContext2D, width: number, height: number, drops: Drop[], flashStartRef: React.MutableRefObject<number | null>): void {
  ctx.clearRect(0, 0, width, height);

  // Drops
  ctx.strokeStyle = 'rgba(180, 195, 215, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i]!;
    d.y += d.speed;
    d.x += d.speed * 0.18; // slight wind
    if (d.y - d.length > height) {
      drops[i] = makeDrop(width, height);
      continue;
    }
    if (d.x > width) d.x = 0;
    ctx.moveTo(d.x, d.y - d.length);
    ctx.lineTo(d.x - d.length * 0.18, d.y);
  }
  ctx.stroke();

  // Lightning flash (drawn over the drops, full-canvas).
  const flashStart = flashStartRef.current;
  if (flashStart !== null) {
    const elapsed = performance.now() - flashStart;
    if (elapsed >= STORM_TIMING.flashDurationMs) {
      flashStartRef.current = null;
    } else {
      let alpha = 0;
      for (const phase of STORM_TIMING.phases) {
        if (elapsed < phase.endMs) {
          alpha = phase.alpha;
          break;
        }
      }
      if (alpha > 0) {
        const { r, g, b } = STORM_TIMING.flashColor;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fillRect(0, 0, width, height);
      }
    }
  }
}
