/**
 * Build-time asset pipeline knobs. These are read by `pnpm gen-cat` when
 * regenerating the piece catalog from source images; they don't affect the
 * runtime app.
 */

/** Maximum side length, in pixels, that a piece image is resized to during
 *  catalog generation. Larger images are downscaled (with Sharp) so the
 *  catalog stays under the body-size limit.
 *
 *  Picked to match `DEFAULT_BASE_CELL_SIZE` (64 px) so raster piece images
 *  render at 1:1 in Suelo / Estructuras subdivisions (ratio 1) on
 *  standard DPI displays. HiDPI displays bilinear-upscale to 128 px
 *  effective — still sharp for tile-sized art. Higher subdivisions
 *  (ratio 3 → 21 px cell, ratio 6 → 11 px cell) downscale aggressively;
 *  not a quality hit because the source already over-samples. */
export const MAX_PIECE_IMAGE_SIZE_PX = 64;