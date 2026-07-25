-- CreateTable
CREATE TABLE "SubdivisionConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "textureSetId" TEXT NOT NULL,
    "cellSizeRatio" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubdivisionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubdivisionConfig_order_idx" ON "SubdivisionConfig"("order");
