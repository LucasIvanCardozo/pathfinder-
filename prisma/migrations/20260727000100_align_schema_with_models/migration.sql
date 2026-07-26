-- Final alignment of the database with the current Prisma schema. Previous
-- migrations (init_paint, texture_ids, doors) were authored before the
-- traits refactor and named columns/tables after `texture` and `door`,
-- which the schema and the application code have since renamed/removed.
-- This migration brings production to a state where the columns and
-- tables match the schema exactly.

-- 1. PaintedCell.textureId → PaintedCell.pieceId (matches current schema).
ALTER TABLE "PaintedCell" RENAME COLUMN "textureId" TO "pieceId";

-- 2. PaintedCell.entityState — JSON column used by traits (e.g. door-states
-- stores the current "open" | "closed" | "locked" value per cell).
ALTER TABLE "PaintedCell" ADD COLUMN "entityState" JSONB;

-- 3. Drop the orphaned `Door` table. The model was removed from the schema
-- when state moved into PaintedCell.entityState; the table has no consumer.
DROP TABLE IF EXISTS "Door";
