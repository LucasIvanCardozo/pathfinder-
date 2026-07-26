"use client";

import { useEffect, useRef } from "react";
import overlayStyles from "./weather-overlay.module.css";

/**
 * Translucent fog with two perceptual layers:
 *   - Far wisps (~40% of total): large, slow, very translucent — give depth.
 *   - Near wisps (~60% of total): smaller, faster, more opaque — give motion.
 *
 * Vertical motion is sinusoidal around each wisp's `baseY`, so the field
 * gently bobs up and down. Horizontal drift is linear per-wisp. Each wisp
 * is rendered as a soft radial gradient; we use `globalCompositeOperation =
 * "lighter"` so that overlapping wisps accumulate instead of stacking
 * opaquely, producing a haze-like feel rather than a sheet of paint.
 *
 * Color carries a faint cool tint (`#e8ecf4`) so the fog reads as
 * atmospheric and not as plain white paint.
 */
export function FogEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    type Wisp = {
      x: number;
      baseY: number;
      r: number;
      vx: number;
      ampY: number;
      freqY: number;
      phaseY: number;
      alpha: number;
      y: number; // updated each frame
    };

    let wisps: Wisp[] = [];
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

      // Density scales with area but is more dense than before.
      const count = Math.min(40, Math.max(14, Math.floor((width * height) / 18_000)));
      wisps = Array.from({ length: count }, (_, i) => {
        const isFar = (i % 5) < 2; // ~40% far, 60% near
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
    };

    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 1;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < wisps.length; i++) {
        const w = wisps[i]!;
        w.x += w.vx;
        w.y = w.baseY + Math.sin(t * w.freqY + w.phaseY) * w.ampY;

        if (w.x - w.r > width) w.x = -w.r;
        if (w.y - w.r > height) w.y = -w.r;
        if (w.y + w.r < 0) w.y = height + w.r;

        const grad = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
        grad.addColorStop(0, `rgba(232, 236, 244, ${w.alpha})`);
        grad.addColorStop(1, "rgba(232, 236, 244, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
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

  return <canvas ref={canvasRef} className={overlayStyles.overlay} tabIndex={-1} aria-hidden="true" />;
}