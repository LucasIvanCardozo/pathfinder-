'use client'

import { useEffect, useState } from 'react'
import type { Texture } from '@/pieces'

/**
 * Blur intensities (in pixels) pre-rendered for every texture. Indexed by
 * `BlurTier`. Higher tier = stronger blur, used for cells in subdivisions
 * that are "farther" from the active one in the Z order.
 */
export type BlurTier = 0 | 1 | 2 | 3
export const BLUR_PX: Record<BlurTier, number> = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
}

export type ImageVariants = Record<BlurTier, HTMLImageElement>

/**
 * Loads a set of textures and pre-renders 4 variants per texture (one per
 * blur tier). The original image plus 3 progressively blurred copies are
 * generated once at load time via `canvas.filter`, then cached for the
 * lifetime of the hook. This gives us runtime blur without paying the cost
 * of Konva's per-node `cache()` call.
 */
export function useTextureImages(textures: Texture[]): Map<string, ImageVariants> {
  const [images, setImages] = useState<Map<string, ImageVariants>>(new Map())

  useEffect(() => {
    if (textures.length === 0) {
      setImages(new Map())
      return
    }

    // Cancellation flag: when `textures` changes (or the component unmounts),
    // we discard in-flight loads to avoid setting stale variants.
    let cancelled = false
    const map = new Map<string, ImageVariants>()
    let finished = 0
    const total = textures.length

    for (const texture of textures) {
      const baseImg = new window.Image()
      baseImg.crossOrigin = 'anonymous'
      baseImg.onload = () => {
        if (cancelled) return
        map.set(texture.id, generateVariants(baseImg))
        finished++
        if (finished === total) setImages(new Map(map))
      }
      baseImg.onerror = () => {
        if (cancelled) return
        finished++
        if (finished === total) setImages(new Map(map))
      }
      baseImg.src = texture.imagePath
    }

    return () => {
      cancelled = true
    }
  }, [textures])

  return images
}

/**
 * Renders the source image at all blur tiers using the browser's native
 * canvas filter. Tier 0 reuses the source image directly (no filter).
 */
function generateVariants(src: HTMLImageElement): ImageVariants {
  // tier 0 is the unmodified image
  const variants: Partial<ImageVariants> = { 0: src }
  for (const tier of [1, 2, 3] as const) {
    variants[tier] = blurImage(src, BLUR_PX[tier])
  }
  return variants as ImageVariants
}

function blurImage(src: HTMLImageElement, blurPx: number): HTMLImageElement {
  const canvas = document.createElement('canvas')
  canvas.width = src.naturalWidth || src.width
  canvas.height = src.naturalHeight || src.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.filter = `blur(${blurPx}px)`
  ctx.drawImage(src, 0, 0)
  const out = new Image()
  out.src = canvas.toDataURL()
  return out
}
