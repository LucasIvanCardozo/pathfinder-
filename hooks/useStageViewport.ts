"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";


type MapDims = { baseCellSize: number; width: number; height: number };

type Params = {
  /** Map dimensions shared by every floor in the scenario. */
  mapDims: MapDims;
  /** Display zoom multiplier. 1 = 100% (world pixels). The Stage applies
   *  it as a transform; pan/center-preservation effects read it but do not
   *  own it — zoom stays in the parent (header buttons). */
  zoom: number;
};

type WorldBounds = { x: number; y: number; width: number; height: number };

type Return = {
  containerRef: RefObject<HTMLDivElement | null>;
  viewportSize: { width: number; height: number };
  pan: { x: number; y: number };
  setPan: (next: { x: number; y: number }) => void;
  /**
   * Begin a pan drag at the given client coords. The window-level
   * mousemove/touchmove handlers (registered by this hook) read the latest
   * drag start and update `pan` accordingly. Calling code is responsible for
   * calling this from the appropriate pointer-down event (typically the
   * active FloorCanvas's `onMouseDown` or `onTouchStart`).
   */
  beginPan: (clientX: number, clientY: number) => void;
  isSpaceDown: boolean;
  /**
   * Reactive mirror of the drag-start ref so cursor computation in child
   * components can re-render when the pan starts/ends. Non-active floors
   * get `false` regardless.
   */
  isPanning: boolean;
  /**
   * Visible world rect (world coords) — used by grid-line culling and any
   * other viewport-driven filtering. `null` until the viewport has a non-zero
   * size.
   */
  worldBounds: WorldBounds | null;
};

/**
 * Owns the shared viewport state for the paint canvas: container size,
 * pan offset, space-key tracking, and the math that keeps the world centred
 * on first paint and preserves the visual centre across zoom changes.
 *
 * Window-level mouse/touch listeners are registered here so a pan drag
 * survives the cursor leaving the floor div — this matches the prior
 * behaviour of the monolithic `PaintCanvas`.
 */
export function useStageViewport({ mapDims, zoom }: Params): Return {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Track viewport size. The Stage uses these as its intrinsic dimensions
  // so the rendered area matches the editor canvas region regardless of zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Centre the world on first valid viewport size. The `initialCenteredRef`
  // guard keeps this from re-centring on subsequent viewport changes.
  const initialCenteredRef = useRef(false);
  useEffect(() => {
    if (initialCenteredRef.current) return;
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    const worldWidth = mapDims.width * mapDims.baseCellSize;
    const worldHeight = mapDims.height * mapDims.baseCellSize;
    setPan({
      x: viewportSize.width / 2 - (worldWidth * zoom) / 2,
      y: viewportSize.height / 2 - (worldHeight * zoom) / 2,
    });
    initialCenteredRef.current = true;
  }, [viewportSize, zoom, mapDims]);

  // Preserve the visual centre on zoom changes. Math: the world point at the
  // viewport centre before the change is `(viewportCenter - pan) / oldZoom`;
  // multiply by the new zoom and subtract the viewport half-size to position
  // the same world point back at the centre. The latest `pan` is read via a
  // ref so the effect doesn't refire on every pan change, only on zoom.
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  const prevZoomRef = useRef(zoom);
  useEffect(() => {
    if (!initialCenteredRef.current) return;
    if (viewportSize.width === 0) return;
    const prevZoom = prevZoomRef.current;
    if (prevZoom === zoom) return;
    const currentPan = panRef.current;
    const worldCx = (viewportSize.width / 2 - currentPan.x) / prevZoom;
    const worldCy = (viewportSize.height / 2 - currentPan.y) / prevZoom;
    setPan({
      x: viewportSize.width / 2 - worldCx * zoom,
      y: viewportSize.height / 2 - worldCy * zoom,
    });
    prevZoomRef.current = zoom;
  }, [zoom, viewportSize.width, viewportSize.height]);

  // Visible world rect (world coords). Konva applies the zoom as a stage
  // transform, so dividing viewport pixels by zoom gives world units.
  const worldBounds = useMemo<WorldBounds | null>(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return null;
    return {
      x: -pan.x / zoom,
      y: -pan.y / zoom,
      width: viewportSize.width / zoom,
      height: viewportSize.height / zoom,
    };
  }, [pan.x, pan.y, zoom, viewportSize.width, viewportSize.height]);

  // Track the space key to enable space+drag panning. `preventDefault` stops
  // the browser from scrolling the page when space is held.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpaceDown(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpaceDown(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Begin a pan drag. Caller-provided coords (typically `event.clientX/Y`).
  const beginPan = (clientX: number, clientY: number) => {
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
  };

  // Window-level mouse listeners for panning so the drag survives the
  // cursor leaving the canvas area.
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const drag = dragStartRef.current;
      setPan({
        x: drag.panX + (e.clientX - drag.mouseX),
        y: drag.panY + (e.clientY - drag.mouseY),
      });
    };
    const handleUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  // Touch listeners mirror the mouse handlers. Single-finger drag pans; a
  // future two-finger gesture could hook in here for pinch-zoom. The
  // `touchmove` listener is intentionally passive so the browser can scroll
  // elsewhere without waiting for JS.
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const drag = dragStartRef.current;
      setPan({
        x: drag.panX + (t.clientX - drag.mouseX),
        y: drag.panY + (t.clientY - drag.mouseY),
      });
    };
    const handleTouchEnd = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null;
        setIsPanning(false);
      }
    };
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  return {
    containerRef,
    viewportSize,
    pan,
    setPan,
    beginPan,
    isSpaceDown,
    isPanning,
    worldBounds,
  };
}
