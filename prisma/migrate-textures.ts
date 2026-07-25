// One-time data migration: rename old textureIds to the new ones
// after the texture catalog was reorganized into subdirectories.
//
// Old IDs → New IDs (matches the catalog):
const RENAMES: Record<string, string> = {
  "stone-floor": "floor-stone",
  "wood-floor": "floor-wood",
  "sand-floor": "floor-sand",
  "water": "water-plain",
  "lava": "lava-plain",
  "stone-wall": "wall-stone",
  "object-placeholder": "decoration-marker",
};

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  let totalUpdated = 0;

  // 1. Update SubdivisionConfig.textureIds
  const subs = await prisma.subdivisionConfig.findMany();
  for (const sub of subs) {
    const oldIds = JSON.parse(sub.textureIds) as string[];
    const newIds = oldIds.map((id) => RENAMES[id] ?? id);
    if (JSON.stringify(oldIds) !== JSON.stringify(newIds)) {
      await prisma.subdivisionConfig.update({
        where: { id: sub.id },
        data: { textureIds: JSON.stringify(newIds) },
      });
      totalUpdated++;
      console.log(`  Subdivision "${sub.name}": [${oldIds.join(", ")}] → [${newIds.join(", ")}]`);
    }
  }

  // 2. Update PaintedCell.textureId
  for (const [oldId, newId] of Object.entries(RENAMES)) {
    const result = await prisma.paintedCell.updateMany({
      where: { textureId: oldId },
      data: { textureId: newId },
    });
    if (result.count > 0) {
      console.log(`  PaintedCells: ${result.count} cell(s) ${oldId} → ${newId}`);
      totalUpdated += result.count;
    }
  }

  console.log(`\n✓ Migration complete. ${totalUpdated} record(s) updated.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
