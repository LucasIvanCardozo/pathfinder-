-- Refactor: replace the GM-placed effect model with a spell model that
-- resolves shape/colour from a hardcoded template catalog.
--
-- Drops the old `ScenarioEffect` (which carried widthFt / depthFt / color /
-- durationKind / remainingRounds / expired / label / kind) and re-creates it
-- with the spellcasting refactor columns (templateId / originCellX Int /
-- originCellY Int / rotationDeg Int / casterCombatantId + the cast snapshot).
--
-- All existing effect rows are dropped — they were transient GM markers that
-- cannot be losslessly migrated to the new shape (no templateId to derive
-- shape from). The GM re-casts as needed.

-- DropTable
DROP TABLE IF EXISTS "ScenarioEffect";

-- CreateTable
CREATE TABLE "ScenarioEffect" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "originCellX" INTEGER NOT NULL,
    "originCellY" INTEGER NOT NULL,
    "rotationDeg" INTEGER NOT NULL DEFAULT 0,
    "casterCombatantId" TEXT,
    "castOnTurnIndex" INTEGER NOT NULL,
    "castOnRoundNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioEffect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioEffect_scenarioId_idx" ON "ScenarioEffect"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioEffect_floorId_idx" ON "ScenarioEffect"("floorId");

-- CreateIndex
CREATE INDEX "ScenarioEffect_casterCombatantId_idx" ON "ScenarioEffect"("casterCombatantId");

-- AddForeignKey
ALTER TABLE "ScenarioEffect" ADD CONSTRAINT "ScenarioEffect_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEffect" ADD CONSTRAINT "ScenarioEffect_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SetNull on caster delete (orphan marker stays visible until the GM removes
-- it; cleanup also runs on next scenario load).
ALTER TABLE "ScenarioEffect" ADD CONSTRAINT "ScenarioEffect_casterCombatantId_fkey" FOREIGN KEY ("casterCombatantId") REFERENCES "Combatant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
