-- Drop the `Scenario_updatedAt_idx` index that the initial migration created
-- but the current schema no longer declares. No query uses it; the only
-- place it was referenced (`orderBy: { updatedAt: "desc" }` in
-- listScenarios) reads from the table without needing an index.
DROP INDEX IF EXISTS "Scenario_updatedAt_idx";
