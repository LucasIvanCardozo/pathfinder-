import { z } from "zod";
import { PIECE_CATEGORIES } from "./types";
import { TextureTraitSchema } from "./traits";

export const PieceCategorySchema = z.enum(PIECE_CATEGORIES);

export const VisualStateSchema = z.object({
  id: z.string().min(1),
  imagePath: z.string().min(1),
  isDefault: z.boolean().optional(),
});

/**
 * A piece is something the GM can paint into a floor cell. See
 * `src/pieces/types.ts` for the full description.
 */
export const PieceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  category: PieceCategorySchema,
  visualStates: z.array(VisualStateSchema).min(1, "Al menos un visualState requerido"),
  width: z.number().int().min(1).max(2048),
  height: z.number().int().min(1).max(2048),
  tags: z.array(z.string().min(1).max(40)).default([]),
  traits: z.array(TextureTraitSchema).optional(),
});

/** Backwards-compat. Same as PieceSchema. */
export const TextureSchema = PieceSchema;

export const SubdivisionConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Nombre requerido").max(100),
  pieceIds: z.array(z.string().min(1)),
  cellSizeRatio: z.number().int().min(1).max(64),
  order: z.number().int().min(0).max(20),
});

/** @deprecated use SubdivisionConfigSchema. */
export const SubdivisionConfigInputSchema = SubdivisionConfigSchema.omit({ id: true });
export const SubdivisionConfigPieceIdsInputSchema = SubdivisionConfigInputSchema;

export const PaintedCellSchema = z.object({
  id: z.string().min(1),
  floorId: z.string().min(1),
  subdivisionId: z.string().min(1),
  gridX: z.number().int(),
  gridY: z.number().int(),
  pieceId: z.string().min(1),
  entityState: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const FloorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  baseCellSize: z.number().int().min(10).max(200),
  width: z.number().int().min(1).max(200),
  height: z.number().int().min(1).max(200),
});

export const DoorStateSchema = z.enum(["open", "closed", "locked"]);

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  floors: z.array(FloorSchema).min(1, "Al menos un piso requerido"),
  activeFloorId: z.string().min(1),
  paintedCells: z.array(PaintedCellSchema),
});

export const ScenarioInputSchema = z.object({
  name: z.string().min(1).max(200),
  floors: z.array(FloorSchema).min(1),
  paintedCells: z.array(PaintedCellSchema),
});
export type ScenarioInput = z.infer<typeof ScenarioInputSchema>;