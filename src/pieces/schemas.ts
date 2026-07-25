import { z } from "zod";
import { DOOR_STATES, PIECE_CATEGORIES } from "./types";

export const PieceCategorySchema = z.enum(PIECE_CATEGORIES);

export const TextureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  imagePath: z.string().min(1),
  width: z.number().int().min(1).max(2048),
  height: z.number().int().min(1).max(2048),
  category: PieceCategorySchema,
  tags: z.array(z.string().min(1).max(40)).default([]),
});

export const SubdivisionConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Nombre requerido").max(100),
  textureIds: z.array(z.string().min(1)),
  cellSizeRatio: z.number().int().min(1).max(64),
  order: z.number().int().min(0).max(20),
});

export const SubdivisionConfigInputSchema = SubdivisionConfigSchema.omit({ id: true });

export const PaintedCellSchema = z.object({
  id: z.string().min(1),
  floorId: z.string().min(1),
  subdivisionId: z.string().min(1),
  gridX: z.number().int(),
  gridY: z.number().int(),
  textureId: z.string().min(1),
});

export const FloorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  baseCellSize: z.number().int().min(10).max(200),
  width: z.number().int().min(1).max(200),
  height: z.number().int().min(1).max(200),
});

export const DoorStateSchema = z.enum(DOOR_STATES);

export const DoorSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  floorId: z.string().min(1),
  textureId: z.string().min(1),
  gridX: z.number().int(),
  gridY: z.number().int(),
  state: DoorStateSchema,
  orientation: z.number().int().default(0),
});

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  floors: z.array(FloorSchema).min(1, "Al menos un piso requerido"),
  activeFloorId: z.string().min(1),
  paintedCells: z.array(PaintedCellSchema),
  doors: z.array(DoorSchema),
});

export const ScenarioInputSchema = z.object({
  name: z.string().min(1).max(200),
  floors: z.array(FloorSchema).min(1),
  paintedCells: z.array(PaintedCellSchema),
  doors: z.array(DoorSchema),
});
export type ScenarioInput = z.infer<typeof ScenarioInputSchema>;
