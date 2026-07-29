-- Drop the dead pieceIds column on SubdivisionConfig. Pieces are global per
-- lib/shared/types/piece.types.ts; the column was never read or written by
-- application code. The schema also strips the implicit DEFAULT 64/20/15 on
-- Scenario.baseCellSize/width/height, which were left over from the original
-- map_dims_to_scenario migration and are not present in schema.prisma.

-- AlterTable
ALTER TABLE "Scenario" ALTER COLUMN "baseCellSize" DROP DEFAULT,
ALTER COLUMN "width" DROP DEFAULT,
ALTER COLUMN "height" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SubdivisionConfig" DROP COLUMN "pieceIds";