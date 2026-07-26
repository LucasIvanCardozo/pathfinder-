# Repository Pattern

Repositories are the only place in the server tree that talks to Prisma. They expose DTOs and accept a `db` or `tx` so they work in and out of transactions.

## Decision

- Export a **factory** or a **plain object of functions** that takes `db` (or `tx`) and returns the entity-specific operations.
- Return **DTOs only**. Never expose a Prisma model instance, never include `@prisma/client` types in the return type.
- Repository methods may throw on infrastructure failures (connection lost, constraint violation). Use cases translate those into `ActionResult` failures; they do not surface as 500s in the UI.

## Shape

```ts
// lib/server/db/repository/scenario.repository.ts
import type { PrismaClient, Prisma } from '@prisma/client';
import type { Scenario, ScenarioInput } from '@/lib/shared/types/scenario.types';

export function scenarioRepository(db: PrismaClient | Prisma.TransactionClient) {
  return {
    findAll(): Promise<Scenario[]> { /* ... */ },
    findById(id: string): Promise<Scenario | null> { /* ... */ },
    upsert(input: ScenarioInput): Promise<Scenario> { /* ... */ },
    deleteById(id: string): Promise<void> { /* ... */ },
  };
}
```

## Rules

| Rule | Why |
|------|-----|
| Factory takes `db` (or `tx`) | Lets callers pass a transactional client. |
| Returns DTOs | Avoids leaking Prisma's mutable model instances across layer boundaries. |
| No business rules | A repository does not validate piece-id sets or check whether a subdivision is in use. Those are use case jobs. |
| No caching directives | Caching is a use case concern (where `'use cache'` lives). |
| No throwing on expected failures | `findById` returns `null`; the use case decides what `null` means. |
| One file per entity | Filename `<entity>.repository.ts`. |
| Never import the singleton | Repositories accept `db`/`tx` as a parameter; the singleton lives at TARGET `lib/server/db/db.ts` (CURRENT `src/db/client.ts`). |

## Quick path

1. Create `lib/server/db/repository/<entity>.repository.ts`.
2. Export a factory `function <entity>Repository(db) { return { ... } }`.
3. Each method takes only the inputs it needs (id, filter, payload); `db` is closed over.
4. Convert Prisma rows to DTOs inside the method. Do not return the raw row.

## Anti-patterns

- `export async function getScenario(id) { return prisma.scenario.findUnique(...) }` — no `db` injection, no DTO conversion.
- Importing `@/db` (CURRENT) or `@/lib/server/db/db` (TARGET) inside a repository. Always accept `db` so the caller controls transactions.
- Returning `Scenario & { floors: Floor[] }` where `floors` contains Prisma relation objects.
- Adding `'use cache'` inside a repository. Caching is a use case concern.
- Putting `.findMany({ where: { ... } })` calls in actions or components. Always go through a use case.

## CURRENT vs TARGET

Repositories do not exist as a layer yet. The CURRENT code calls `prisma.*` from inside action files and even from the `listSubdivisions` read path (`src/app/actions/subdivisions.ts::ensureDefaultSubdivisions`). The CURRENT Prisma singleton lives at `src/db/client.ts`; the TARGET singleton moves to `lib/server/db/db.ts` during the migration.

| CURRENT location | TARGET repository |
|------------------|-------------------|
| `prisma.scenario.{findMany,findUnique,...}` in `src/app/actions/scenarios.ts` | `scenarioRepository(db).{findAll,findById,upsert,...}` |
| `prisma.subdivisionConfig.*` in `src/app/actions/subdivisions.ts` | `subdivisionRepository(db).*` |
| `prisma.paintedCell.count` and `prisma.paintedCell.createMany` in scenario save | `paintedCellRepository(tx).*` invoked from `scenarioUseCases.save` |

Until the layer exists, repository-shaped functions may live inside the action file as a precursor, but they must still accept `db` and return DTOs.

## Related

- [use-case-pattern.md](./use-case-pattern.md) — what calls repositories.
- [entity-file-pattern.md](./entity-file-pattern.md) — file placement.
- [folder-architecture.md](./folder-architecture.md) — `lib/server/db/repository/` location.