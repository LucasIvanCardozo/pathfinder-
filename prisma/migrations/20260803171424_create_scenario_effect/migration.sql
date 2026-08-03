-- CreateTable
CREATE TABLE "ScenarioEffect" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originX" DOUBLE PRECISION NOT NULL,
    "originY" DOUBLE PRECISION NOT NULL,
    "widthM" DOUBLE PRECISION NOT NULL,
    "depthM" DOUBLE PRECISION NOT NULL,
    "rotationDeg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL,
    "durationKind" TEXT NOT NULL,
    "remainingRounds" INTEGER NOT NULL,
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioEffect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioEffect_scenarioId_idx" ON "ScenarioEffect"("scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioEffect_floorId_idx" ON "ScenarioEffect"("floorId");

-- AddForeignKey
ALTER TABLE "ScenarioEffect" ADD CONSTRAINT "ScenarioEffect_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEffect" ADD CONSTRAINT "ScenarioEffect_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
