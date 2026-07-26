"use client";

import { useEffect, useRef } from "react";

/**
 * Lightweight canvas-overlay rain animation. Uses a single <canvas> sized to
 * its parent, with a small particle pool updated per requestAnimationFrame.
 * Pure visuals — `pointer-events: none` lets the underlying paint canvas
 * keep receiving input.
 */
export function RainEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

      // Density proportional to area, capped.
      const count = Math.min(400, Math.floor((width * height) / 6000));
      drops = Array.from({ length: count }, () => makeDrop(width, height, true));
    };

    const makeDrop = (w: number, h: number, initial = false): Drop => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : -10,
      speed: 8 + Math.random() * 10,
      length: 10 + Math.random() * 14,
    });

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(180, 200, 220, 0.55)";
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

  return <canvas ref={canvasRef} className="weather-overlay weather-rain" tabIndex={-1} aria-hidden="true" />;
}
