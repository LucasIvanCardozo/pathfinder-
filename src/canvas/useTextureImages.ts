'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Loads a set of image paths and resolves each to a single `HTMLImageElement`.
 * One image per path — the depth-blur effect is now a CSS `filter: blur(...)`
 * on the floor container, so per-tier pre-rendered variants are no longer
 * needed.
 *
 * Returns a `Map` whose **reference is stable** as long as the underlying set
 * of loaded paths doesn't change. The internal `useState` caches the result so
 * downstream memo comparators (FloorCanvas) don't invalidate on every render.
 *
 * Cancellation: when `paths` content changes (or the component unmounts), any
 * in-flight loads are discarded so we never write stale entries.
 */
export function useTextureImages(paths: readonly string[]): Map<string, HTMLImageElement> {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Content-stable signature of the path set. The effect's only dep is this
  // string, so a new `paths` array with identical contents (HMR, parent
  // re-bucketing) keeps the signature unchanged and the effect does NOT re-run.
  // Cheap vs. the network roundtrip it gates: O(N log N) only on content shift.
  const signature = useMemo(() => paths.slice().sort().join('\x1f'), [paths]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: signature derives from paths (content equality); depending on the array directly would re-fetch on every parent re-bucket.
  useEffect(() => {
    if (paths.length === 0) {
      setImages(new Map());
      return;
    }

    let cancelled = false;
    const map = new Map<string, HTMLImageElement>();
    let finished = 0;
    const total = paths.length;

    for (const path of paths) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        map.set(path, img);
        finished++;
        if (finished === total) setImages(new Map(map));
      };
      img.onerror = () => {
        if (cancelled) return;
        finished++;
        if (finished === total) setImages(new Map(map));
      };
      img.src = path;
    }

    return () => {
      cancelled = true;
    };
    // Depend on `signature` only — not on `paths` — so the effect gates on
    // content equality, not on the array's reference identity. See comment
    // above for why this matters.
  }, [signature]);

  // A previous version wrapped `images` in `useMemo(() => images, [images])`,
  // which was a no-op. `images` is already a stable state value that only
  // changes via `setImages`, so we return it directly.
  return images;
}
