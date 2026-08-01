/**
 * Sentinel pieceId written into PaintedCells that belong to the `obscured`
 * subdivision. The value is meaningless — the FloorCanvas renderer dispatches
 * on `subdivisionId === 'obscured'` and ignores pieceId — but the Prisma
 * schema marks `pieceId` as non-null, so any non-empty string works. No
 * corresponding row exists in the `Piece` table; rendering never looks it up.
 *
 * If the schema ever adds a foreign key on `pieceId`, this becomes a real
 * piece (a 1x1 black PNG) or pieceId is migrated to nullable. Until then,
 * the sentinel keeps the feature migration-free.
 */
export const DARKNESS_PIECE_ID = '__darkness__';