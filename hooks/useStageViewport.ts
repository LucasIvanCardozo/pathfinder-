'use client';

import { useEffect, useMemo, useRef } from 'react';
import { usePanState } from './usePanState';
import { usePanModifier } from './usePanModifier';
import { useViewportSize } from './useViewportSize';

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
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportSize: { width: number; height: number };
  pan: { x: number; y: number };
  setPan: (next: { x: number; y: number }) => void;
  /**
   * Begin a pan drag at the given client coords. Reads the live `pan`
   * via `panRef` so the callback stays referentially stable across pan
   * updates (avoids invalidating FloorCanvas's memo on every pan change).
   */
  beginPan: (clientX: number, clientY: number) => void;
  isPanDown: boolean;
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
 * Composes three single-responsibility hooks (`useViewportSize`, `usePanModifier`,
 * `usePanState`) plus the centre-on-mount and preserve-centre-on-zoom effects
 * that orchestrate them.
 */
export function useStageViewport({ mapDims, zoom }: Params): Return {
  const { containerRef, viewportSize } = useViewportSize();
  const { pan, setPan, beginPan, isPanning } = usePanState();
  const isPanDown = usePanModifier();

  // Centre the world on first valid viewport size; the ref guard prevents
  // re-centring on subsequent viewport changes.
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
  }, [viewportSize, zoom, mapDims, setPan]);

  // Preserve the visual centre on zoom. The latest `pan` is read via a
  // ref so the effect only fires on zoom, not on pan. Math: the world
  // point at the viewport centre before the change is `(viewportCenter - pan)
  // / oldZoom`; multiply by the new zoom and re-anchor.
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
  }, [zoom, viewportSize.width, viewportSize.height, setPan]);

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

  return {
    containerRef,
    viewportSize,
    pan,
    setPan,
    beginPan,
    isPanDown,
    isPanning,
    worldBounds,
  };
}
