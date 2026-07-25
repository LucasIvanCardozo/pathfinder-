// Seed the database with the initial Pathfinder pieces pack.
// Idempotent: re-running won't duplicate rows.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const STARTING_PIECES = [
  {
    id: "floor-stone-1x1",
    name: "Piedra",
    category: "floor",
    footprintX: 1,
    footprintY: 1,
    imagePath: "/pieces/dummy/floor-stone.svg",
    tags: ["stone", "floor"],
  },
  {
    id: "wall-stone-1x1",
    name: "Muro piedra",
    category: "wall",
    footprintX: 1,
    footprintY: 1,
    imagePath: "/pieces/dummy/wall-stone.svg",
    tags: ["stone", "wall"],
  },
  {
    id: "wall-stone-2x2",
    name: "Muro grande",
    category: "wall",
    footprintX: 2,
    footprintY: 2,
    imagePath: "/pieces/dummy/wall-stone-2x2.svg",
    tags: ["stone", "wall"],
  },
  {
    id: "water-1x1",
    name: "Agua",
    category: "water",
    footprintX: 1,
    footprintY: 1,
    imagePath: "/pieces/dummy/water.svg",
    tags: ["water"],
  },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const pack = await prisma.pack.upsert({
    where: { id: "core-pathfinder" },
    update: {},
    create: {
      id: "core-pathfinder",
      name: "Pathfinder Core",
      version: "0.1.0",
      author: "system",
    },
  });

  for (const piece of STARTING_PIECES) {
    await prisma.pieceDefinition.upsert({
      where: { id: piece.id },
      update: {
        name: piece.name,
        category: piece.category,
        footprintX: piece.footprintX,
        footprintY: piece.footprintY,
        imagePath: piece.imagePath,
        tags: JSON.stringify(piece.tags),
        packId: pack.id,
      },
      create: {
        id: piece.id,
        name: piece.name,
        category: piece.category,
        footprintX: piece.footprintX,
        footprintY: piece.footprintY,
        imagePath: piece.imagePath,
        tags: JSON.stringify(piece.tags),
        packId: pack.id,
      },
    });
  }

  const count = await prisma.pieceDefinition.count();
  console.log(`✓ Seeded ${count} pieces in pack "${pack.name}"`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
