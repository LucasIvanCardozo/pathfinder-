/**
 * `blocks-light` trait: a cell with this trait is opaque to light. Used by
 * future features (darkness, line-of-sight, field-of-view). The trait carries
 * the `opacity` (0..1) which the renderer will use to mask light rays.
 *
 * No UI today — the trait is data-only. Walls will declare this trait so
 * future raycasting code can iterate over `cell.textures[*].traits` to find
 * occluders.
 */
export const blocksLightTrait = {
  kind: "blocks-light" as const,

  /** Default opacity for a freshly painted cell with this trait. */
  defaultOpacity(): number {
    return 1.0;
  },

  /** Resolve the opacity from a cell's entityState (defaults to 1). */
  resolveOpacity(state: unknown): number {
    const v = typeof state === "number" ? state : Number(state);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1.0;
  },

  /** No menu for this trait (it's a passive capability). */
  getMenu: null,
};

export type BlocksLightTrait = typeof blocksLightTrait;