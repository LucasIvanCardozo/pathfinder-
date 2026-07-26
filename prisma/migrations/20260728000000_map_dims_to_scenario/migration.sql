-- Extract map dimensions (baseCellSize, width, height) from Floor to
-- Scenario. Floors are vertical slices of the same map and must share
-- these values; storing them on Floor made that invariant unenforced.
--
-- Defaults (64/20/15) keep the migration runnable against an existing
-- populated database. In this codebase the migration is always paired
-- with a database reset, so the defaults don't matter in practice.

-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "baseCellSize" INTEGER NOT NULL DEFAULT 64;
ALTER TABLE "Scenario" ADD COLUMN "width" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "Scenario" ADD COLUMN "height" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "Floor" DROP COLUMN "baseCellSize";
ALTER TABLE "Floor" DROP COLUMN "width";
ALTER TABLE "Floor" DROP COLUMN "height";