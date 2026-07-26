// Back-compat barrel. The canonical schemas live under
// `lib/shared/schemas/<entity>.schemas.ts`; this file re-exports them so
// existing callers (`import { X } from "@/pieces"`) keep resolving during
// the migration. New code must import from `@/lib/shared/schemas/...`.
export * from "@/lib/shared/schemas/floor.schemas";
export * from "@/lib/shared/schemas/paintedCell.schemas";
export * from "@/lib/shared/schemas/piece.schemas";
export * from "@/lib/shared/schemas/scenario.schemas";
export * from "@/lib/shared/schemas/subdivision.schemas";