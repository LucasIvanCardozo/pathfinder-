"use server";

import { revalidatePath } from "next/cache";
import { ALL_PIECES } from "@/assets";
import { prisma } from "@/db";
import {
  type Piece,
  type SubdivisionConfig,
  SubdivisionConfigPieceIdsInputSchema,
} from "@/pieces";

const DEFAULT_SUBDIVISIONS: Omit<SubdivisionConfig, "id">[] = [
  {
    name: "Suelo",
    pieceIds: ["floor-stone", "floor-wood", "floor-sand", "water-plain", "lava-plain", "floor-pasto"],
    cellSizeRatio: 1,
    order: 0,
  },
  {
    name: "Objetos",
    pieceIds: ["decoration-marker"],
    cellSizeRatio: 4,
    order: 1,
  },
  {
    name: "Paredes",
    // The "door" piece is here: it has the door-states trait and behaves
    // like a door when painted. door-closed/open/locked become visualStates
    // of that single Piece.
    pieceIds: ["wall-stone", "door"],
    cellSizeRatio: 8,
    order: 2,
  },
];

export async function listAllPieces(): Promise<Piece[]> {
  return ALL_PIECES;
}

/** @deprecated use listAllPieces. */
export async function listAllTextures(): Promise<Piece[]> {
  return ALL_PIECES;
}

function rowToConfig(row: {
  id: string;
  name: string;
  pieceIds: string;
  cellSizeRatio: number;
  order: number;
}): SubdivisionConfig {
  return {
    id: row.id,
    name: row.name,
    pieceIds: JSON.parse(row.pieceIds) as string[],
    cellSizeRatio: row.cellSizeRatio,
    order: row.order,
  };
}

async function ensureDefaultSubdivisions() {
  const count = await prisma.subdivisionConfig.count();
  if (count === 0) {
    for (const sub of DEFAULT_SUBDIVISIONS) {
      await prisma.subdivisionConfig.create({
        data: {
          name: sub.name,
          pieceIds: JSON.stringify(sub.pieceIds),
          cellSizeRatio: sub.cellSizeRatio,
          order: sub.order,
        },
      });
    }
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
  const parsed = SubdivisionConfigPieceIdsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const validIds = new Set(ALL_PIECES.map((p) => p.id));
  for (const id of parsed.data.pieceIds) {
    if (!validIds.has(id)) {
      return { success: false, error: `Pieza inválida: ${id}` };
    }
  }
  const created = await prisma.subdivisionConfig.create({
    data: {
      name: parsed.data.name,
      pieceIds: JSON.stringify(parsed.data.pieceIds),
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
  const parsed = SubdivisionConfigPieceIdsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }
  const validIds = new Set(ALL_PIECES.map((p) => p.id));
  for (const id of parsed.data.pieceIds) {
    if (!validIds.has(id)) {
      return { success: false, error: `Pieza inválida: ${id}` };
    }
  }
  const updated = await prisma.subdivisionConfig.update({
    where: { id },
    data: {
      name: parsed.data.name,
      pieceIds: JSON.stringify(parsed.data.pieceIds),
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
  const sub = await prisma.subdivisionConfig.findUnique({ where: { id } });
  if (!sub) {
    return { success: false, error: "Subdivision no encontrada" };
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