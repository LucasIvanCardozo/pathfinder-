"use client";

import { useEffect, useRef } from "react";
import overlayStyles from "./weather-overlay.module.css";

type Props = {
  /** Timestamp (ms) of the most recent thunder trigger. When this value
   *  changes, a brief lightning flash fires. Pass `null` if no thunder
   *  has been heard yet. */
  thunderAt: number | null;
};

/**
 * Storm canvas overlay — drops + lightning flashes.
 *
 * Structure mirrors `RainEffect` (heavy drops with diagonal wind) and adds
 * a flash layer driven by the `thunderAt` prop. A flash is a short, two-
 * stage pulse (full white → gap → medium) tuned to mimic a natural
 * lightning strike (~250 ms total). The next flash only fires when a new
 * `thunderAt` value arrives, so visuals stay perfectly synced with the
 * thunder audio without an internal timer.
 */
export function StormEffect({ thunderAt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Shared between effects: the drawing loop reads `flashStart` each
  // frame to know when to paint a flash overlay. The prop sync effect
  // writes to it whenever a new thunder arrives.
  const flashStartRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    type Drop = { x: number; y: number; speed: number; length: number };
    let drops: Drop[] = [];
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

      const count = Math.min(450, Math.floor((width * height) / 5_000));
      drops = Array.from({ length: count }, () => makeDrop(width, height, true));
    };

    const makeDrop = (w: number, h: number, initial = false): Drop => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : -10,
      speed: 9 + Math.random() * 11,
      length: 12 + Math.random() * 14,
    });

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Drops
      ctx.strokeStyle = "rgba(180, 195, 215, 0.6)";
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

      // 2. Lightning flash (drawn over the drops, full-canvas).
      const flashStart = flashStartRef.current;
      if (flashStart !== null) {
        const elapsed = performance.now() - flashStart;
        if (elapsed >= 600) {
          flashStartRef.current = null;
        } else {
          // Mimics a natural lightning strike: bright primary
          // discharge, brief gap, secondary lobe, smaller tertiary
          // pulse, then a long afterglow. Slightly bluish tint —
          // real lightning reads faintly violet-white, not pure
          // white.
          let alpha = 0;
          if (elapsed < 50) alpha = 0.95; // primary discharge
          else if (elapsed < 110) alpha = 0; // gap
          else if (elapsed < 200) alpha = 0.65; // secondary lobe
          else if (elapsed < 260) alpha = 0.05; // small gap
          else if (elapsed < 380) alpha = 0.35; // tertiary pulse
          else alpha = 0.12; // afterglow tail
          if (alpha > 0) {
            ctx.fillStyle = `rgba(225, 232, 250, ${alpha})`;
            ctx.fillRect(0, 0, width, height);
          }
        }
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

  // Sync external thunder trigger into the loop's flash state.
  useEffect(() => {
    if (thunderAt === null) return;
    flashStartRef.current = performance.now();
  }, [thunderAt]);

  return (
    <canvas
      ref={canvasRef}
      className={overlayStyles.overlay}
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}