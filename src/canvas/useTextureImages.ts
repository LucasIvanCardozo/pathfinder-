"use client";

import { useEffect, useState } from "react";

/**
 * Loads a set of image paths and resolves each to a single `HTMLImageElement`.
 * One image per path — the depth-blur effect is now a CSS `filter: blur(...)`
 * on the floor container, so per-tier pre-rendered variants are no longer
 * needed.
 *
 * Cancellation: when `paths` changes (or the component unmounts), any
 * in-flight loads are discarded so we never write stale entries.
 */
export function useTextureImages(paths: readonly string[]): Map<string, HTMLImageElement> {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map());

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
      img.crossOrigin = "anonymous";
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
  }, [paths]);

  return images;
}
