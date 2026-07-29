"use client";

import { useMemo } from "react";
import type { SubdivisionConfig } from "@/lib/shared/types";

/**
 * Builds a stable `id -> SubdivisionConfig` lookup from a subdivision list.
 * Used by the canvas paint pipeline to resolve which subdivision owns a cell.
 */
export function useSubdivisionMap(
  subdivisions: readonly SubdivisionConfig[],
): Map<string, SubdivisionConfig> {
  return useMemo(() => {
    const m = new Map<string, SubdivisionConfig>();
    for (const s of subdivisions) m.set(s.id, s);
    return m;
  }, [subdivisions]);
}
