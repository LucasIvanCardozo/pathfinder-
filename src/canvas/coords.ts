// Pure coordinate-mapping utilities. No React, no Konva dependency.
// All functions here are deterministic and unit-testable.

/**
 * Maps a viewport (clientX/clientY) coordinate to the canvas element's
 * internal coordinate space.
 *
 * Why this is a single utility instead of inline math:
 * The Konva stage lives inside a scrollable container (`.canvas` with
 * `overflow: auto; max-width: 100%`). When the world is larger than the
 * viewport, the container scrolls horizontally/vertically; the `<canvas>`
 * element itself moves within the page viewport as the user scrolls.
 *
 * Reading the `<canvas>`'s `getBoundingClientRect()` already accounts for
 * the parent scroll (the canvas moves with the scroll). The
 * `scaleX = rect.width / canvas.width` ratio then handles any CSS scale
 * applied to the canvas (today: none; future: Konva `stage.scaleX/Y` for
 * zoom).
 *
 * The previous inline math (`(clientX - rect.left) / rect.width *
 * stageNativeWidth`) assumed the container rendered the world at 1:1, which
 * is only true when no scrolling happens. That assumption broke both the
 * left-click paint and the right-click door-menu flows whenever the canvas
 * overflowed the viewport.
 *
 * @param container The DOM element that wraps the Konva stage. The function
 *                  looks up the inner `<canvas>` itself.
 * @param clientX   The viewport-relative X coordinate (typically from
 *                  `MouseEvent.clientX` or `Touch.clientX`).
 * @param clientY   The viewport-relative Y coordinate.
 * @returns The point in the canvas's intrinsic coordinate system, or `null`
 *          if the container has no `<canvas>` child yet (e.g. before
 *          hydration).
 */
export function clientToCanvas(
  container: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const canvas = container.querySelector("canvas");
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width;
  const scaleY = rect.height / canvas.height;
  return {
    x: (clientX - rect.left) / scaleX,
    y: (clientY - rect.top) / scaleY,
  };
}