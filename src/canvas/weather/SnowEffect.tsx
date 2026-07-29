'use client';

import { useEffect, useRef } from 'react';
import overlayStyles from './weather-effect.module.css';

/**
 * Slow-falling snowflakes. Each flake is a soft white dot with subtle drift.
 * Heavier density than fog, lighter than rain — gives a constant, gentle
 * "snowing" feel without overwhelming the underlying paint canvas.
 */
export function SnowEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    type Flake = { x: number; y: number; r: number; vy: number; swing: number; phase: number };
    let flakes: Flake[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(220, Math.max(60, Math.floor((width * height) / 8000)));
      flakes = Array.from({ length: count }, () => makeFlake(width, height, true));
    };

    const makeFlake = (w: number, h: number, initial = false): Flake => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : -10,
      r: 1.2 + Math.random() * 2.4,
      vy: 0.5 + Math.random() * 1.2,
      swing: 0.4 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    });

    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 1;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(245, 248, 255, 0.85)';
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]!;
        f.y += f.vy;
        f.x += Math.sin(t * 0.02 + f.phase) * f.swing * 0.3;
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
      raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);
    resize();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={overlayStyles.overlay} tabIndex={-1} aria-hidden="true" />
  );
}
