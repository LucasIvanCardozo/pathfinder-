-- Rename ScenarioEffect columns from legacy "metres" / abstract-units to
-- Pathfinder's canonical units: feet for size and grid cell coords for the
-- anchor.
--
-- Old units vs new units:
--   - `originX` / `originY` were stored as world pixels (== render units)
--     multiplied by the scenario's `baseCellSize`. Convert to grid cell coords
--     by dividing by `baseCellSize` (per scenario).
--   - `widthM` / `depthM` were stored in the same abstract render units
--     (the name was misleading — values were always in pixels). Convert to
--     feet by `pixels / baseCellSize * FEET_PER_BASE_CELL` (per scenario).
--
-- The transformation runs in a single UPDATE with a FROM-clause joining
-- `Scenario` so each row uses its owning scenario's `baseCellSize`.

-- Step 1: rename columns (no value change yet — same data, new names).
ALTER TABLE "ScenarioEffect" RENAME COLUMN "originX" TO "originCellX";
ALTER TABLE "ScenarioEffect" RENAME COLUMN "originY" TO "originCellY";
ALTER TABLE "ScenarioEffect" RENAME COLUMN "widthM" TO "widthFt";
ALTER TABLE "ScenarioEffect" RENAME COLUMN "depthM" TO "depthFt";

-- Step 2: transform values from pixels/units to the new units. Per scenario:
--   originCellX = originCellX / s.baseCellSize   (pixels / px-per-cell)
--   originCellY = originCellY / s.baseCellSize
--   widthFt     = widthFt     / s.baseCellSize * 5   (pixels -> cells -> ft)
--   depthFt     = depthFt     / s.baseCellSize * 5
UPDATE "ScenarioEffect" AS e
SET
  "originCellX" = e."originCellX" / s."baseCellSize",
  "originCellY" = e."originCellY" / s."baseCellSize",
  "widthFt"     = e."widthFt"     / s."baseCellSize" * 5,
  "depthFt"     = e."depthFt"     / s."baseCellSize" * 5
FROM "Scenario" AS s
WHERE e."scenarioId" = s."id";