# Use Case Pattern

Use cases own business rules and orchestrate repositories. They are plain TypeScript with no framework boundary.

## Decision

- Export a **plain object** of async methods. Never a class.
- **No `'use server'`** inside use case files. The Server Action provides the server boundary; `'use server'` inside a use case body is ignored by Next.js and creates confusion.
- **Cached reads take no `db` argument.** They import the server singleton at the top of the use-case module and pass it into the repository themselves. The cache key must be derivable from serialisable runtime inputs only (filters, ids, pagination).
- **Writes accept `db: PrismaClient | Prisma.TransactionClient` as their first parameter.** The Server Action passes the injected client; a transactional write may also accept a `tx`.
- Use cases may declare `'use cache'` (TARGET) at the **start of the function body** so cache directives are visible at a glance.

## Reads (with caching)

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { db } from '@/lib/server/db/db';
import { pieceRepository } from '@/lib/server/db/repository/piece.repository';

export const pieceUseCases = {
  async getAll() {
    'use cache';
    cacheLife('hours');
    cacheTag('pathfinder:pieces');
    return pieceRepository(db).findAll();
  },
};
```

`'use cache'`, `cacheLife`, and `cacheTag` all live at the start of the function body in one consistent order. Use `'use cache'` (local) today; `'use cache: remote'` requires a Redis/KV cache handler that Pathfinder does not yet configure. See [cache-tag-convention.md](./cache-tag-convention.md).

## Writes (called from actions)

```ts
export const scenarioUseCases = {
  async save(db: PrismaClient, data: ScenarioInput) {
    return scenarioRepository(db).upsert(data);
  },
};
```

Mutations do not use `'use cache'`. They run inside a transaction when the change spans multiple tables (e.g. scenario upsert with floors and painted cells).

## Transactions

Use a small `runInTx(db)` helper from `lib/server/utils/runInTx.ts` for transactional operations. The helper accepts a callback and returns its result, so use cases do not duplicate the try/catch boilerplate:

```ts
import { runInTx } from '@/lib/server/utils/runInTx';

export const scenarioUseCases = {
  async save(db: PrismaClient, data: ScenarioInput) {
    return runInTx(db, async (tx) => scenarioRepository(tx).upsert(data));
  },
};
```

Until the helper ships, inline the transaction inside the use case method.

## Rules

| Rule | Why |
|------|-----|
| Plain object export, not a class | Easier to tree-shake, no `this` binding surprises, plays well with RSC import boundaries. |
| No `'use server'` here | Action boundary is the Server Action. Mixing them hides the boundary. |
| Cached reads take no `db` argument | Lets the cache key stay serialisable; the singleton is bound at module scope. |
| Writes accept `db` as their first parameter | Lets callers pass a transactional client and keeps use cases pure. |
| Cache directives at function start | Easier to grep, harder to miss invalidation. |
| Reads tag with `pathfinder:` namespace | See [cache-tag-convention.md](./cache-tag-convention.md). |

## Quick path

1. Create `lib/server/useCases/<entity>.usecases.ts`.
2. Export `export const <entity>UseCases = { ... }`.
3. **Read methods take no `db`** — they import the server singleton at the top and pass it into the repository. **Write methods take `db` first.**
4. Reads may add `'use cache'` + `cacheLife` + `cacheTag` at the start of the body.
5. Call only `<entity>Repository(db)`. No direct Prisma calls inside use cases.

## Anti-patterns

- `export class <entity>UseCases { ... }`. Classes obscure RSC bundling and force `this`.
- A cached read that takes a `db` argument. Reads must use the server singleton imported inside the module; passing a client would change the cache key contract.
- Importing the singleton at module scope in a *write* use case and ignoring the injected `db`. Writes must accept the client so callers control transactions.
- Putting `'use cache'` after any other statement inside the function body.
- Calling another use case from inside a use case. Use cases compose **through** the repository, not by chaining.
- Doing data shaping (mapping Prisma rows to DTOs) inside the use case. The repository returns DTOs; use cases orchestrate.

## CURRENT vs TARGET

CURRENT use cases live inside `src/app/actions/*.ts`. The use case layer is not extracted yet; business rules are inline. Examples to extract during migration:

| CURRENT inline logic | TARGET use case |
|----------------------|-----------------|
| `saveScenario` validation + Prisma transaction in `src/app/actions/scenarios.ts` | `scenarioUseCases.save(db, input)` |
| `createSubdivision`, `updateSubdivision`, `deleteSubdivision` validation + piece-id lookup in `src/app/actions/subdivisions.ts` | `subdivisionUseCases.create/update/delete(db, input)` |
| `listSubdivisions`'s `ensureDefaultSubdivisions` mutation | Moved to a bootstrap/migration use case; the read use case must not mutate (see [cache-tag-convention.md](./cache-tag-convention.md)). |

Until the migration, treat `src/app/actions/*` as the use case boundary as well.

## Related

- [server-action-pattern.md](./server-action-pattern.md) — actions call use cases.
- [repository-pattern.md](./repository-pattern.md) — repositories receive `db` from use cases.
- [cache-tag-convention.md](./cache-tag-convention.md) — read-side tagging rules.
- Next.js: [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components).