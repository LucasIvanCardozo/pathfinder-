-- CreateTable
CREATE TABLE "Door" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "textureId" TEXT NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'closed',
    "orientation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Door_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Door_scenarioId_idx" ON "Door"("scenarioId");

-- CreateIndex
CREATE INDEX "Door_floorId_idx" ON "Door"("floorId");

-- AddForeignKey
ALTER TABLE "Door" ADD CONSTRAINT "Door_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Door" ADD CONSTRAINT "Door_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
