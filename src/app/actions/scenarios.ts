"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { Prisma } from "@/generated/prisma/client";
import { type Scenario, ScenarioInputSchema } from "@/pieces";

export type ScenarioSummary = {
  id: string;
  name: string;
  floorCount: number;
  paintedCellCount: number;
  updatedAt: Date;
};

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const rows = await prisma.scenario.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      floors: {
        include: {
          _count: { select: { paintedCells: true } },
        },
      },
    },
  });
  return rows.map((s) => {
    const cellCount = s.floors.reduce((sum, f) => sum + f._count.paintedCells, 0);
    return {
      id: s.id,
      name: s.name,
      floorCount: s.floors.length,
      paintedCellCount: cellCount,
      updatedAt: s.updatedAt,
    };
  });
}

export type LoadScenarioResult = {
  id: string;
  name: string;
  floors: Scenario["floors"];
  activeFloorId: string;
  paintedCells: Scenario["paintedCells"];
};

export async function loadScenario(id: string): Promise<LoadScenarioResult | null> {
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      floors: {
        orderBy: { order: "asc" },
        include: { paintedCells: true },
      },
    },
  });
  if (!scenario) return null;
  // Default to the "Planta Baja" floor so users always land on the ground
  // floor when opening a scenario, regardless of which floor they were on
  // when they last saved. Falls back to the lowest-ordered floor only as a
  // safety net for legacy scenarios that don't follow the naming convention.
  const plantaBaja = scenario.floors.find(
    (f) => f.name.toLowerCase() === "planta baja",
  );
  const initialFloor = plantaBaja ?? scenario.floors[0];
  if (!initialFloor) return null;
  return {
    id: scenario.id,
    name: scenario.name,
    floors: scenario.floors.map((f) => ({
      id: f.id,
      name: f.name,
      baseCellSize: f.baseCellSize,
      width: f.width,
      height: f.height,
    })),
    activeFloorId: initialFloor.id,
    paintedCells: scenario.floors.flatMap((f) =>
      f.paintedCells.map((c) => ({
        id: c.id,
        floorId: c.floorId,
        subdivisionId: c.subdivisionId,
        gridX: c.gridX,
        gridY: c.gridY,
        pieceId: c.pieceId,
        entityState: (c.entityState ?? undefined) as Scenario["paintedCells"][number]["entityState"],
      })),
    ),
  };
}

export type SaveScenarioInput = {
  id?: string;
  name: string;
  floors: Scenario["floors"];
  paintedCells: Scenario["paintedCells"];
};

export async function saveScenario(input: SaveScenarioInput): Promise<{ id: string }> {
  const validated = ScenarioInputSchema.safeParse({
    id: input.id ?? "pending",
    name: input.name,
    floors: input.floors,
    paintedCells: input.paintedCells,
  });
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { name, floors, paintedCells } = validated.data;

  const floorData = floors.map((f, i) => ({
    id: f.id,
    name: f.name,
    baseCellSize: f.baseCellSize,
    width: f.width,
    height: f.height,
    order: i,
  }));
  const cellData = paintedCells.map((cell) => ({
    id: cell.id,
    floorId: cell.floorId,
    subdivisionId: cell.subdivisionId,
    gridX: cell.gridX,
    gridY: cell.gridY,
    pieceId: cell.pieceId,
    entityState: (cell.entityState ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
  }));

  if (input.id) {
    const scenarioId = input.id;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.floor.deleteMany({ where: { scenarioId } });
      const scenario = await tx.scenario.update({
        where: { id: scenarioId },
        data: {
          name,
          floors: { create: floorData },
        },
      });
      if (cellData.length > 0) {
        await tx.paintedCell.createMany({ data: cellData });
      }
      return scenario;
    });
    revalidatePath("/");
    return { id: updated.id };
  }

  const created = await prisma.$transaction(async (tx) => {
    const scenario = await tx.scenario.create({
      data: {
        name,
        floors: { create: floorData },
      },
    });
    if (cellData.length > 0) {
      await tx.paintedCell.createMany({ data: cellData });
    }
    return scenario;
  });
  revalidatePath("/");
  return { id: created.id };
}


function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export async function deleteScenario(id: string): Promise<void> {
  await prisma.scenario.delete({ where: { id } });
  revalidatePath("/");
}

/**
 * Creates a brand-new scenario with a single Planta Baja floor and
 * redirects to its editor. Used by the "+ Nuevo" button on the home page.
 */
export async function createBlankScenario(): Promise<never> {
  const scenarioId = generateId("scenario");
  const floorId = generateId("floor");
  await prisma.scenario.create({
    data: {
      id: scenarioId,
      name: "Nuevo escenario",
      floors: {
        create: [
          {
            id: floorId,
            name: "Planta Baja",
            baseCellSize: 64,
            width: 16,
            height: 12,
            order: 0,
          },
        ],
      },
    },
  });
  revalidatePath("/");
  redirect(`/editor?id=${scenarioId}`);
}