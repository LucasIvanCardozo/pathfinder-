/**
 * Generates a short, sortable, URL-safe id with a caller-provided prefix.
 * Identical body to the old helpers in `src/app/actions/scenarios.ts` and
 * `src/app/editor/EditorClient.tsx`; centralised here per
 * `docs/architecture/folder-architecture.md` so every entity uses the same
 * format. The id is not cryptographically random — collision is acceptable
 * for in-app scenario/floor ids but it is NOT safe for security contexts.
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * The set of entity kinds that have a typed `newId` helper. `IdKind` is the
 * canonical source of truth for the prefix literals `cell` / `floor` /
 * `scenario` so typos surface at compile time instead of in a runtime id.
 */
export type IdKind = 'cell' | 'floor' | 'scenario';

/** Typed wrapper around `generateId` for the known entity prefixes. */
export function newId(kind: IdKind): string {
  return generateId(kind);
}
