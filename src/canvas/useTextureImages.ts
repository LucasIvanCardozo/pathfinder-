"use client";

import { useEffect, useState } from "react";
import type { Texture } from "@/pieces";

/**
 * Loads a set of textures into HTMLImageElement instances, returning a
 * Map keyed by texture id. Re-uses the browser's image cache so the same
 * texture isn't loaded twice when used in multiple layers.
 */
export function useTextureImages(textures: Texture[]): Map<string, HTMLImageElement> {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    if (textures.length === 0) {
      setImages(new Map());
      return;
    }
    const map = new Map<string, HTMLImageElement>();
    let loaded = 0;
    const total = textures.length;
    for (const texture of textures) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Skip stale loads from a previous texture set.
        if (!textures.includes(texture)) return;
        map.set(texture.id, img);
        loaded++;
        if (loaded === total) setImages(new Map(map));
      };
      img.onerror = () => {
        loaded++;
        if (loaded === total) setImages(new Map(map));
      };
      img.src = texture.imagePath;
    }
  }, [textures]);

  return images;
}
