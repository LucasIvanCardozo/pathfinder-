"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/db";
import { SubdivisionConfigInputSchema, type SubdivisionConfig, type Texture } from "@/pieces";
import { ALL_TEXTURES } from "@/assets";

const DEFAULT_SUBDIVISIONS: Omit<SubdivisionConfig, "id">[] = [
  {
    name: "Suelo",
    textureIds: ["floor-stone", "floor-wood", "floor-sand", "water-plain", "lava-plain"],
    cellSizeRatio: 1,
    order: 0,
  },
  {
    name: "Objetos",
    textureIds: ["decoration-marker"],
    cellSizeRatio: 4,
    order: 1,
  },
  {
    name: "Paredes",
    textureIds: ["wall-stone"],
    cellSizeRatio: 8,
    order: 2,
  },
];

// Always-present subdivisions that exist alongside any user-created ones.
// "Puertas" is special: it always exists, holds the door textures, and
// cannot be deleted (enforced by the server actions).
const ALWAYS_PRESENT: Omit<SubdivisionConfig, "id"> = {
  name: "Puertas",
  textureIds: ALL_TEXTURES.filter((t) => t.id.startsWith("door-")).map((t) => t.id),
  cellSizeRatio: 1,
  order: 3,
};

export async function listAllTextures(): Promise<Texture[]> {
  return ALL_TEXTURES;
}

function rowToConfig(row: {
  id: string;
  name: string;
  textureIds: string;
  cellSizeRatio: number;
  order: number;
}): SubdivisionConfig {
  return {
    id: row.id,
    name: row.name,
    textureIds: JSON.parse(row.textureIds) as string[],
    cellSizeRatio: row.cellSizeRatio,
    order: row.order,
  };
}

async function ensureDefaultSubdivisions() {
  // Seed the initial 3 if the table is empty.
  const count = await prisma.subdivisionConfig.count();
  if (count === 0) {
    for (const sub of DEFAULT_SUBDIVISIONS) {
      await prisma.subdivisionConfig.create({
        data: {
          name: sub.name,
          textureIds: JSON.stringify(sub.textureIds),
          cellSizeRatio: sub.cellSizeRatio,
          order: sub.order,
        },
      });
    }
  }

  // Always ensure "Puertas" exists. If it doesn't, create it. This is
  // idempotent — running on every load is safe.
  const doorsExists = await prisma.subdivisionConfig.findFirst({
    where: { name: ALWAYS_PRESENT.name },
  });
  if (!doorsExists) {
    await prisma.subdivisionConfig.create({
      data: {
        name: ALWAYS_PRESENT.name,
        textureIds: JSON.stringify(ALWAYS_PRESENT.textureIds),
        cellSizeRatio: ALWAYS_PRESENT.cellSizeRatio,
        order: ALWAYS_PRESENT.order,
      },
    });
  }
}

export async function listSubdivisions(): Promise<SubdivisionConfig[]> {
  await ensureDefaultSubdivisions();
  const rows = await prisma.subdivisionConfig.findMany({
    orderBy: { order: "asc" },
  });
  return rows.map(rowToConfig);
}

export type CreateSubdivisionResult =
  | { success: true; subdivision: SubdivisionConfig }
  | { success: false; error: string };

export async function createSubdivision(
  input: Omit<SubdivisionConfig, "id">,
): Promise<CreateSubdivisionResult> {
  const parsed = SubdivisionConfigInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const validIds = new Set(ALL_TEXTURES.map((t) => t.id));
  for (const id of parsed.data.textureIds) {
    if (!validIds.has(id)) {
      return { success: false, error: `Textura inválida: ${id}` };
    }
  }
  const created = await prisma.subdivisionConfig.create({
    data: {
      name: parsed.data.name,
      textureIds: JSON.stringify(parsed.data.textureIds),
      cellSizeRatio: parsed.data.cellSizeRatio,
      order: parsed.data.order,
    },
  });
  revalidatePath("/editor");
  return {
    success: true,
    subdivision: rowToConfig(created),
  };
}

export type UpdateSubdivisionResult =
  | { success: true; subdivision: SubdivisionConfig }
  | { success: false; error: string };

export async function updateSubdivision(
  id: string,
  input: Omit<SubdivisionConfig, "id">,
): Promise<UpdateSubdivisionResult> {
  const parsed = SubdivisionConfigInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const validIds = new Set(ALL_TEXTURES.map((t) => t.id));
  for (const id of parsed.data.textureIds) {
    if (!validIds.has(id)) {
      return { success: false, error: `Textura inválida: ${id}` };
    }
  }
  const updated = await prisma.subdivisionConfig.update({
    where: { id },
    data: {
      name: parsed.data.name,
      textureIds: JSON.stringify(parsed.data.textureIds),
      cellSizeRatio: parsed.data.cellSizeRatio,
      order: parsed.data.order,
    },
  });
  revalidatePath("/editor");
  return {
    success: true,
    subdivision: rowToConfig(updated),
  };
}

export type DeleteSubdivisionResult = { success: true } | { success: false; error: string };

export async function deleteSubdivision(id: string): Promise<DeleteSubdivisionResult> {
  // The "Puertas" subdivision is special and cannot be deleted.
  // We look it up by name to avoid relying on a hardcoded id.
  const sub = await prisma.subdivisionConfig.findUnique({ where: { id } });
  if (!sub) {
    return { success: false, error: "Subdivision no encontrada" };
  }
  if (sub.name === ALWAYS_PRESENT.name) {
    return {
      success: false,
      error: `"${ALWAYS_PRESENT.name}" es una subcapa especial y no se puede borrar`,
    };
  }
  const used = await prisma.paintedCell.count({ where: { subdivisionId: id } });
  if (used > 0) {
    return {
      success: false,
      error: `No se puede borrar: hay ${used} celda(s) pintada(s) usando esta subdivision`,
    };
  }
  await prisma.subdivisionConfig.delete({ where: { id } });
  revalidatePath("/editor");
  return { success: true };
}

export async function reorderSubdivisions(orders: { id: string; order: number }[]): Promise<void> {
  await prisma.$transaction(
    orders.map((o) =>
      prisma.subdivisionConfig.update({
        where: { id: o.id },
        data: { order: o.order },
      }),
    ),
  );
  revalidatePath("/editor");
}
