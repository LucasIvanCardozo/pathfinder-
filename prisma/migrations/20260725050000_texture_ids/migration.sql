-- Migrate SubdivisionConfig from textureSetId to textureIds (array).
-- Existing rows are mapped based on the prior texture set membership.

-- 1. Add the new column with a safe default.
ALTER TABLE "SubdivisionConfig"
  ADD COLUMN "textureIds" TEXT NOT NULL DEFAULT '[]';

-- 2. Populate textureIds from the old textureSetId.
UPDATE "SubdivisionConfig" SET
  "textureIds" = CASE "textureSetId"
    WHEN 'ground'  THEN '["stone-floor","wood-floor","sand-floor","water","lava"]'
    WHEN 'objects' THEN '["object-placeholder"]'
    WHEN 'walls'   THEN '["stone-wall"]'
    ELSE '[]'
  END;

-- 3. Drop the old column.
ALTER TABLE "SubdivisionConfig" DROP COLUMN "textureSetId";
