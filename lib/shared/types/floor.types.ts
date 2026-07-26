import type { z } from "zod";
import type { FloorSchema } from "@/lib/shared/schemas/floor.schemas";

export type Floor = z.infer<typeof FloorSchema>;