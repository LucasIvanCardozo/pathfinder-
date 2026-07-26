# Entity File Pattern

Every domain entity follows a five-file split, grouped by layer. Deviation is an exception that needs a header comment.

## Decision

| Layer | File | Purpose | Location (TARGET) |
|-------|------|---------|-------------------|
| Shared | `*.schemas.ts` | Zod validation | `lib/shared/schemas/` |
| Shared | `*.types.ts` | TypeScript types | `lib/shared/types/` |
| Server | `*.repository.ts` | Prisma queries | `lib/server/db/repository/` |
| Server | `*.usecases.ts` | Business logic | `lib/server/useCases/` |
| Server | `*.action.ts` | Server Action entry | `lib/server/actions/` |

Singular file names (`piece.schemas.ts`, `scenario.schemas.ts`) are the default. Collection payloads (`combos.schemas.ts`) are acceptable only when the schema validates a list, not a singleton. Singletons in collection-named files must carry a header comment justifying the plural.

## Example — Scenario

```text
lib/shared/schemas/scenario.schemas.ts        // ScenarioSchema, ScenarioInputSchema
lib/shared/types/scenario.types.ts            // type Scenario = z.infer<...>
lib/server/db/repository/scenario.repository.ts
lib/server/useCases/scenario.usecases.ts
lib/server/actions/scenario.action.ts
```

## Rules

| File | Rule |
|------|------|
| `*.schemas.ts` | Only Zod schemas and `z.infer` types for that entity. No Prisma imports. |
| `*.types.ts` | DTOs only. Re-exports from `@prisma/client` are forbidden; infer from schemas. |
| `*.repository.ts` | Pure Prisma. Returns DTOs (or `null`/arrays). Never throws business errors. |
| `*.usecases.ts` | Plain object of async methods. No classes, no `'use server'`. Cached reads take no `db`; writes accept `db`/`tx`. |
| `*.action.ts` | `'use server'` at top. `createAction(schema, handler)` per operation. |

The handler signature inside `createAction` receives `{ data, db }`; the wrapper passes the singleton into write handlers automatically. Schema names travel with the entity until a shared schema module is justified; do not preemptively split them into a `common` folder.

## Quick path

1. **Schemas first.** `piece.schemas.ts` with `PieceSchema`, `PieceInputSchema = PieceSchema.omit({ id: true })`.
2. **Types second.** `piece.types.ts` re-exports the inferred types; add DTOs only if the wire shape diverges.
3. **Repository third.** One factory per entity: `pieceRepository(db)` with `findAll`, `findById`, `create`, `update`, `delete`.
4. **Use cases fourth.** `pieceUseCases.list()` for cached reads (imports the singleton inside the module) and `pieceUseCases.save(db, input)` for writes (accept the injected client). Calls `pieceRepository(db)`. Adds business rules.
5. **Action last.** `piece.action.ts` exports `listPieces = createAction(null, async () => pieceUseCases.list())` for reads and `savePiece = createAction(PieceInputSchema, async ({ data, db }) => pieceUseCases.save(db, data))` for writes.

## Anti-patterns

- Two entities sharing one schema file.
- A use case file that imports `@/db` directly instead of taking `db` as a parameter.
- A repository returning a Prisma model instance (`return prisma.scenario.findUnique(...)`) instead of a DTO.
- An action that mixes Zod parsing, business logic, and Prisma calls in one function body.
- A `*.types.ts` that re-exports `@prisma/client` types directly. Always infer from schemas.

## CURRENT vs TARGET

The CURRENT files live under `src/pieces/`:

| CURRENT file | TARGET split |
|--------------|-------------|
| `src/pieces/types.ts` (Scenario, SubdivisionConfig, Floor, PaintedCell, Piece) | `lib/shared/types/{scenario,subdivision,floor,paintedCell,piece}.types.ts` |
| `src/pieces/schemas.ts` (ScenarioSchema, SubdivisionConfigSchema, etc.) | `lib/shared/schemas/{scenario,subdivision,...}.schemas.ts` |
| `src/pieces/traits.ts` (piece behaviour traits consumed by the canvas) | `lib/shared/types/piece.traits.ts` (move alongside `piece.types.ts`) |
| `src/app/actions/scenarios.ts` (Prisma + business + validation) | Split into `scenario.{repository,usecases,action}.ts` |

`src/pieces/traits.ts` exists today and carries canvas-side behaviour traits that depend on `src/pieces/types.ts`. When the migration lands, `traits.ts` becomes `lib/shared/types/piece.traits.ts` (or stays with the piece domain under `lib/shared/`); it is not a separate layer. The five-file split is the target shape; do not introduce a third file pattern.

## Related

- [folder-architecture.md](./folder-architecture.md) — folder placement rules.
- [server-action-pattern.md](./server-action-pattern.md) — `createAction` contract.
- [repository-pattern.md](./repository-pattern.md) — what a repository is and is not.
- [use-case-pattern.md](./use-case-pattern.md) — what a use case is and is not.