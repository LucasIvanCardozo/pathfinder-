import { z } from "zod";

/** A single floor inside a scenario. */
export const FloorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  baseCellSize: z.number().int().min(10).max(200),
  width: z.number().int().min(1).max(200),
  height: z.number().int().min(1).max(200),
});