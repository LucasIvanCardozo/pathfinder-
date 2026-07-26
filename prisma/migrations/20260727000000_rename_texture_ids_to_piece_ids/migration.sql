-- Align the `SubdivisionConfig.textureIds` column (from migration
-- 20260725050000_texture_ids) with the current Prisma schema, which
-- renamed the field to `pieceIds` during the traits refactor. Production
-- was previously running with the old column name; this migration brings
-- it in sync.

ALTER TABLE "SubdivisionConfig" RENAME COLUMN "textureIds" TO "pieceIds";
