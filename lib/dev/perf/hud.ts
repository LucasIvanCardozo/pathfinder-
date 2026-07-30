/**
 * Thin wrapper around `stats.js` (mrdoob/stats.js, MIT). The library's
 * `dom` element is created with inline CSS that pins it to the top-left of the
 * viewport; we override those inline styles to land at top-right and append it
 * to a caller-supplied parent so the HUD sits inside the PerfHud panel's
 * stacking context instead of escaping to `<body>`.
 *
 * The wrapper owns a requestAnimationFrame loop that calls `stats.begin()` /
 * `stats.end()` once per frame. The internal `end()` is what advances the
 * canvas-drawn FPS/MS/MB graphs.
 */
import Stats from 'stats.js';

export type StatsHud = {
  begin(): void;
  end(): void;
  destroy(): void;
};

export function createStatsHud(parent: HTMLElement): StatsHud {
  const stats = new Stats();
  // Override the lib's default `top:0;left:0` to anchor at top-right of the
  // PerfHud panel. Setting `left:auto` is required to cancel the inline rule.
  stats.dom.style.top = '0';
  stats.dom.style.right = '0';
  stats.dom.style.left = 'auto';
  parent.appendChild(stats.dom);

  let rafId: number | null = null;

  const tick = (): void => {
    stats.begin();
    stats.end();
    rafId = requestAnimationFrame(tick);
  };

  return {
    begin(): void {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(tick);
    },
    end(): void {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
    destroy(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      stats.dom.remove();
    },
  };
}
