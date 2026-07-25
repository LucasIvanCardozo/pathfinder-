"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/db";
import { type Door, type DoorState, type Scenario, ScenarioInputSchema } from "@/pieces";

export type ScenarioSummary = {
  id: string;
  name: string;
  floorCount: number;
  paintedCellCount: number;
  doorCount: number;
  updatedAt: Date;
};

export async function listScenarios(): Promise<ScenarioSummary[]> {
  const rows = await prisma.scenario.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      floors: {
        include: {
          _count: { select: { paintedCells: true, doors: true } },
        },
      },
    },
  });
  return rows.map((s) => {
    const cellCount = s.floors.reduce((sum, f) => sum + f._count.paintedCells, 0);
    const doorCount = s.floors.reduce((sum, f) => sum + f._count.doors, 0);
    return {
      id: s.id,
      name: s.name,
      floorCount: s.floors.length,
      paintedCellCount: cellCount,
      doorCount,
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
  doors: Door[];
};

export async function loadScenario(id: string): Promise<LoadScenarioResult | null> {
  const scenario = await prisma.scenario.findUnique({
    where: { id },
    include: {
      floors: {
        orderBy: { order: "asc" },
        include: { paintedCells: true, doors: true },
      },
    },
  });
  if (!scenario) return null;
  const firstFloor = scenario.floors[0];
  if (!firstFloor) return null;
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
    activeFloorId: firstFloor.id,
    paintedCells: scenario.floors.flatMap((f) =>
      f.paintedCells.map((c) => ({
        id: c.id,
        floorId: c.floorId,
        subdivisionId: c.subdivisionId,
        gridX: c.gridX,
        gridY: c.gridY,
        textureId: c.textureId,
      })),
    ),
    doors: scenario.floors.flatMap((f) =>
      f.doors.map((d) => ({
        id: d.id,
        scenarioId: d.scenarioId,
        floorId: d.floorId,
        textureId: d.textureId,
        gridX: d.gridX,
        gridY: d.gridY,
        state: d.state as DoorState,
        orientation: d.orientation,
      })),
    ),
  };
}

export type SaveScenarioInput = {
  id?: string;
  name: string;
  floors: Scenario["floors"];
  paintedCells: Scenario["paintedCells"];
  doors: Door[];
};

export async function saveScenario(input: SaveScenarioInput): Promise<{ id: string }> {
  const validated = ScenarioInputSchema.safeParse({
    id: input.id ?? "pending",
    name: input.name,
    floors: input.floors,
    paintedCells: input.paintedCells,
    doors: input.doors,
  });
  if (!validated.success) {
    throw new Error(validated.error.issues[0]?.message ?? "Datos inválidos");
  }

  const { name, floors, paintedCells, doors } = validated.data;

  // Single batch persist: build the data once and run a single
  // transaction that replaces floors + painted cells + doors atomically.
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
    textureId: cell.textureId,
  }));

  if (input.id) {
    // Update: delete floors (cascades to cells and doors) then recreate
    // everything in a single transaction.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.floor.deleteMany({ where: { scenarioId: input.id! } });
      const scenario = await tx.scenario.update({
        where: { id: input.id! },
        data: {
          name,
          floors: { create: floorData },
        },
      });
      if (cellData.length > 0) {
        await tx.paintedCell.createMany({ data: cellData });
      }
      if (doors.length > 0) {
        await tx.door.createMany({
          data: doors.map((door) => ({
            id: door.id,
            scenarioId: scenario.id,
            floorId: door.floorId,
            textureId: door.textureId,
            gridX: door.gridX,
            gridY: door.gridY,
            state: door.state,
            orientation: door.orientation ?? 0,
          })),
        });
      }
      return scenario;
    });
    revalidatePath("/");
    return { id: updated.id };
  }

  // Create: new scenario + floors + cells + doors in a single transaction.
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
    if (doors.length > 0) {
      await tx.door.createMany({
        data: doors.map((door) => ({
          id: door.id,
          scenarioId: scenario.id,
          floorId: door.floorId,
          textureId: door.textureId,
          gridX: door.gridX,
          gridY: door.gridY,
          state: door.state,
          orientation: door.orientation ?? 0,
        })),
      });
    }
    return scenario;
  });
  revalidatePath("/");
  return { id: created.id };
}

export async function deleteScenario(id: string): Promise<void> {
  await prisma.scenario.delete({ where: { id } });
  revalidatePath("/");
}
