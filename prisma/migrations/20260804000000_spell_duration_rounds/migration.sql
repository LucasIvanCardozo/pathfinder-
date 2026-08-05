-- Spell duration (PF1e rule): every ScenarioEffect now carries a
-- `durationRounds` counter. The server decrements it on every
-- `nextTurn` / `advanceRound` op and deletes the row in the same TX
-- when the counter hits zero. Default 1 preserves the legacy
-- one-round behaviour for existing rows (no backfill required).
ALTER TABLE "ScenarioEffect" ADD COLUMN "durationRounds" INTEGER NOT NULL DEFAULT 1;
