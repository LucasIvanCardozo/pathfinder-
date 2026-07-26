# Code Style

Pathfinder enforces style with Biome 2.5.5. The rules below are non-negotiable. The TARGET style is single quotes; Biome's current `quoteStyle: "double"` is CURRENT migration debt (see CURRENT vs TARGET at the bottom).

## Decision

| Aspect | Rule (TARGET) |
|--------|---------------|
| Quotes | Single quotes (`'...'`). |
| Semicolons | Always. |
| Trailing commas | Always (including function args). |
| Line width | 100 characters. |
| Indent | 2 spaces. |
| Imports | Organized (Biome `assist.actions.source.organizeImports`). |
| Components | PascalCase. |
| Non-component files / styles | kebab-case. |
| Module imports | `@/*` path alias for `src/*` (today) and `<root>/*` after migration. |
| Language | English for code, identifiers, schemas, comments; Spanish user-facing copy stays Spanish. |

## Biome commands

```bash
pnpm lint         # read-only check
pnpm lint:fix     # auto-fix lint
pnpm format       # write formatting
pnpm check        # write formatting + lint fixes (intentional)
pnpm typecheck    # tsc --noEmit
```

Only `pnpm lint` and `pnpm typecheck` are read-only. `pnpm lint:fix`, `pnpm format`, and `pnpm check` write files; run them only when you intend to commit.

## Comments

New comments explain **rationale or invariants**, not what the code obviously does. Good examples already in the tree:

- `src/db/client.ts` — explains why the singleton is cached on `globalThis`.
- `src/pieces/traits.ts` — describes what `entityState` keys mean.
- `src/app/actions/scenarios.ts::loadScenario` — explains the "Planta Baja" floor fallback.

Bad examples to avoid:

- `// increment counter` above `counter++`.
- `// loop over floors` above `floors.map(...)`.
- `// TODO` without a follow-up issue.

## Naming

| Token | Convention | Example |
|-------|------------|---------|
| React component file | PascalCase | `SubdivisionManager.tsx` |
| Server Action file | camelCase, `*.action.ts` | `subdivision.action.ts` |
| Use case file | camelCase, `*.usecases.ts` | `subdivision.usecases.ts` |
| Repository file | camelCase, `*.repository.ts` | `subdivision.repository.ts` |
| Schema file | camelCase, `*.schemas.ts` | `subdivision.schemas.ts` |
| Type file | camelCase, `*.types.ts` | `subdivision.types.ts` |
| CSS Module | kebab-case + `.module.css` | `subdivision-manager.module.css` |
| Non-component module | kebab-case | `run-in-tx.ts` |
| TypeScript type | PascalCase | `Scenario`, `SubdivisionConfig` |
| Zod schema | PascalCase + `Schema` | `ScenarioSchema`, `SubdivisionConfigInputSchema` |
| Cache tag string | `pathfinder:<entity>` | `'pathfinder:scenarios'` |

## Conventional commits

```text
feat(scope): add subdivision reordering
fix(editor): clamp cellSizeRatio to 1..64
refactor(actions): split scenarios into use cases
test(use-cases): cover upsert round-trip
docs(architecture): document entity file pattern
chore(deps): bump biome to 2.5.5
```

Scopes match the package or domain (`actions`, `editor`, `subdivision`, `scenario`, `pieces`, `db`, `cache`, `forms`, `styles`). One scope per commit.

## Server vs client boundary

- Server Components by default. Add `'use client'` only when the component needs state, effects, browser APIs, or event handlers.
- Server Actions are server-only. A client component imports them by reference and calls them; do not `await` them inline in a Server Component and expect reactivity.

## TypeScript

- Strict mode is on, including `noUncheckedIndexedAccess`. Every index access returns `T | undefined`; use `?.` or guard.
- Prefer `z.infer` for domain types; never re-export `@prisma/client` types from a domain module.
- Narrow unknown payloads at the boundary with Zod (`safeParse`) before doing anything with them.

## Quick path

1. `pnpm typecheck` to confirm types.
2. `pnpm lint` to confirm style.
3. Stage and commit with a conventional message.

## Anti-patterns

- Disabling Biome rules with `biome-ignore` comments. Fix the underlying code or escalate to a maintainer.
- Using `any` to dodge a type error. Use `unknown` and narrow it.
- Importing from `@/generated/prisma/*` outside `src/db/`. Only the infrastructure layer may import generated types.
- Mixing Spanish into identifiers, schema keys, or comments.
- Manual semicolon insertion, manual indentation, or hand-rolled import sorting.
- Single-letter variable names outside `map((x) => ...)` callbacks.
- Writing new code with double-quote strings. The TARGET style is single quotes; existing double-quote code migrates file-by-file.

## CURRENT vs TARGET

Style rules apply across both trees. Style, not just paths, is mid-migration:

| Aspect | CURRENT | TARGET |
|--------|---------|--------|
| Quote style | Biome `quoteStyle: "double"` (existing source) | Single quotes (`'...'`) — match this in all new code and migrated files |
| Semicolons | Always | Always (no change) |
| Trailing commas | Always | Always (no change) |
| Line width | 100 | 100 (no change) |
| Imports | `@/db` → `src/db/index.ts` | `@/lib/server/db/db` |
| Imports | `@/pieces` → `src/pieces/index.ts` | `@/lib/shared/schemas` or `@/lib/shared/types` |
| Imports | `@/assets` → `src/assets` | `@/lib/server/assets` or a feature folder |
| Singleton path | `src/db/client.ts` | `lib/server/db/db.ts` |

`tsconfig.json`'s `paths` field is updated during the migration. Biome's `quoteStyle` is updated when the rest of the codebase migrates; do not let new code match the old setting. All TS/TSX examples in `docs/` already use the TARGET single-quote style.

## Related

- [folder-architecture.md](../architecture/folder-architecture.md) — where files live.
- [entity-file-pattern.md](../architecture/entity-file-pattern.md) — naming rules for entity files.