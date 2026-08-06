-- Rename `rotationDeg` to `rotationIndex`. The field's semantics changed
-- from a 4-state enum (0|90|180|270) to an 8-state integer in [0..7].
-- The walker in `src/canvas/effects/footprint.ts` now derives the
-- cardinal-vs-diagonal orientation via `rotationIndex % 2 === 1` and the
-- quarter-turn count via `rotationIndex % 4`.
--
-- Existing rows are remapped to the equivalent cardinal state (an old
-- value of `deg` becomes `deg / 90 * 2`, producing state 0, 2, 4 or 6).
-- This preserves the cardinal look at the cost of collapsing any diagonal
-- rows into a cardinal state. The legacy `cone-15/30-cardinal|diagonal`
-- `templateId` values are no longer in the closed enum but the column
-- itself stays `TEXT` — app-level schema enforces the new ids.
ALTER TABLE "ScenarioEffect" RENAME COLUMN "rotationDeg" TO "rotationIndex";

-- Backfill: cardinal states only. Idempotent — repeating produces the same result.
UPDATE "ScenarioEffect"
SET "rotationIndex" = (("rotationIndex" / 90) * 2)
WHERE "rotationIndex" IN (0, 90, 180, 270);
