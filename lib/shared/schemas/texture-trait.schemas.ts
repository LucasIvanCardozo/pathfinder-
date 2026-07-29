import { z } from "zod";

/**
 * Trait definitions for textures. A trait is a piece of behaviour or metadata
 * that can be attached to any texture. The `kind` discriminator lets the
 * renderer/interactor pick the right implementation at runtime via the
 * trait registry (`src/canvas/traits/registry.ts`).
 *
 * Adding a new trait:
 *   1. Define it here (data type + Zod schema).
 *   2. Implement it in `src/canvas/traits/<kind>.ts` and register it in
 *      `src/canvas/traits/registry.ts`.
 *   3. Reference it from a texture via `<metadata><trait kind="..."/></metadata>`
 *      in the SVG, or set `texture.traits` directly in the catalog.
 */

/** A single texture trait, as stored in the catalog (and serialised to JSON). */
export const TextureTraitSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("door-states"),
    /** The state this texture represents (e.g. "closed" for door-closed). */
    state: z.enum(["closed", "open", "locked"]),
  }),
  z.object({
    kind: z.literal("blocks-light"),
    /** 0..1, how opaque the wall is to light. */
    opacity: z.number().min(0).max(1),
  }),
]);

export type TextureTrait = z.infer<typeof TextureTraitSchema>;
