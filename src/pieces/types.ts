// Back-compat barrel. The canonical types live under
// `lib/shared/types/<entity>.types.ts`; this file re-exports them so existing
// callers (`import { X } from "@/pieces"`) keep resolving during the
// migration. New code must import from `@/lib/shared/types/...`.
export * from "@/lib/shared/types/floor.types";
export * from "@/lib/shared/types/paintedCell.types";
export * from "@/lib/shared/types/piece.types";
export * from "@/lib/shared/types/scenario.types";
export * from "@/lib/shared/types/subdivision.types";