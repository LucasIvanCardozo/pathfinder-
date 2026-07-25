-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCellSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaintedCell" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "subdivisionId" TEXT NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "textureId" TEXT NOT NULL,

    CONSTRAINT "PaintedCell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scenario_updatedAt_idx" ON "Scenario"("updatedAt");

-- CreateIndex
CREATE INDEX "Floor_scenarioId_idx" ON "Floor"("scenarioId");

-- CreateIndex
CREATE INDEX "PaintedCell_floorId_subdivisionId_idx" ON "PaintedCell"("floorId", "subdivisionId");

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaintedCell" ADD CONSTRAINT "PaintedCell_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
