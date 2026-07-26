# Data Fetching

Pathfinder separates reads (Server Components + cached use cases) from writes (Server Actions). There is no client-side data fetching library; the client only renders data the server gave it.

## Decision

| Concern | Where | API |
|---------|-------|-----|
| List / detail reads | Server Component calling a use case | `await pieceUseCases.getAll()` (cached reads take no `db`) |
| Mutations | Server Action | `createAction(schema, handler)` |
| Optimistic UI | Client component with `useTransition` | `startTransition(() => formAction(...))` |
| Form feedback | Server Action `ActionResult` | `if (!result.success) setBanner(result.error.message)` |
| Route refresh | Server Action | `revalidatePath('/...')` + `updateTag('...')` |

## Rules

- Server Components are the default. Add `'use client'` only for state, effects, browser APIs, or event handlers.
- Reads go through **use cases**, never repositories directly, never Prisma directly. The use case layer is where caching directives live.
- Mutations go through **Server Actions**. Route Handlers are reserved for non-React callers (none today).
- **Never** import Konva from a Server Component. Konva is client-only.
- **Never** pass Prisma model instances across the RSC boundary; convert to DTOs at the repository.
- **Cached reads never receive a `db` argument.** They import the server singleton inside the use-case module. The wrapper around a cached function in a Server Component must also stay free of Prisma imports.
- Avoid waterfalls: when a Server Component needs two independent reads, await them in `Promise.all`.

## Cached reads

Use cases with `'use cache'` are read-mostly. They participate in partial prerendering. The cached function takes **no `db`/`PrismaClient` argument** — it imports the server singleton inside the module and forwards it to the repository:

```ts
async function getScenarios() {
  'use cache';
  cacheLife('hours');
  cacheTag('pathfinder:scenarios');
  return scenarioUseCases.list();
}
```

A page composes a static shell, a cached list, and a dynamic island. The Server Component only awaits use cases; it never touches Prisma directly:

```tsx
export default async function HomePage() {
  return (
    <>
      <Header /> {/* static */}
      <Suspense fallback={<ScenariosSkeleton />}>
        <ScenarioList /> {/* cached */}
      </Suspense>
    </>
  );
}

async function ScenarioList() {
  const scenarios = await scenarioUseCases.list();
  return <ScenariosGrid scenarios={scenarios} />;
}
```

Cache keys are auto-derived from function arguments and closures; do not pass `keyParts`. **Only pass serialisable runtime values** (filters, ids, pagination cursors) into a cached scope — never pass `Date.now()`, promises, Prisma clients, or other non-serialisable references. Tag every cached read with a `pathfinder:` tag — see [cache-tag-convention.md](./cache-tag-convention.md).

## Dynamic reads

Reads that need request-time data (`cookies()`, `headers()`, `searchParams`) cannot live inside `'use cache'`. Two options:

1. Extract the runtime value outside the cached function and pass it as an argument (the value becomes part of the cache key).
2. Use `'use cache: private'` (compliance-only; Pathfinder does not need it today).

```ts
export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <FilteredList query={q} />;
}

async function FilteredList({ query }: { query?: string }) {
  // query is part of the cache key automatically
  const items = await scenarioUseCases.search({ name: query });
  return <List items={items} />;
}
```

Note the filtered read goes through a use case — never `db.scenario.findMany` from a Server Component.

## Mutations

Server Actions mutate and call `updateTag` immediately so the read-your-own-writes pattern holds:

```ts
'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { scenarioUseCases } from '@/lib/server/useCases/scenario.usecases';

export const saveScenario = createAction(ScenarioInputSchema, async ({ data, db }) => {
  const saved = await scenarioUseCases.save(db, data);
  updateTag('pathfinder:scenarios');
  updateTag(`pathfinder:scenario:${saved.id}`);
  revalidatePath('/');
  return saved;
});
```

When a Server Action wraps `redirect()`, do not use `createAction` — keep it unwrapped. See [server-action-pattern.md](./server-action-pattern.md).

## Anti-patterns

- `useEffect(() => fetch('/api/...'), [])` in a client component when the data could be a server-side prop.
- Importing `@/db` (CURRENT) or `@/lib/server/db/db` (TARGET), or calling `prisma.*`, from a Server Component. Go through a use case.
- A cached read that takes a `db` argument or imports Prisma inside its body. Cached reads must use the singleton the use case module imports; passing the client would change the cache key contract.
- Calling two reads sequentially when they are independent. Use `Promise.all`.
- `fetch()` from a Server Component for an internal resource. The data is already on the server; call the use case.
- Passing non-serialisable values (Prisma clients, `Date.now()`, promises, functions) into a cached scope. They break the cache key.
- A `use cache` function that calls `cookies()` or `headers()`. Refactor to pass the value in.
- `router.refresh()` from a Server Action. Server Actions already invalidate; the refresh is a client signal only.

## CURRENT vs TARGET

The CURRENT data flow is direct: Server Components call `await listScenarios()` (`src/app/actions/scenarios.ts`), which runs Prisma on every request. There is no `'use cache'` yet.

| CURRENT | TARGET |
|---------|--------|
| `await listScenarios()` in `src/app/page.tsx` | `await scenarioUseCases.list()` with `'use cache'` + `cacheTag('pathfinder:scenarios')` |
| `await loadScenario(id)` in `src/app/editor/page.tsx` | `await scenarioUseCases.findById(id)` with `cacheTag('pathfinder:scenarios', 'pathfinder:scenario:{id}')` |
| Direct Prisma in actions | Repository → use case → action chain |

Until the use case layer lands, treat `src/app/actions/*` as the use case boundary and tag with `pathfinder:*` when caching is added.

## Related

- [cache-tag-convention.md](./cache-tag-convention.md) — `pathfinder:` namespace, `updateTag`.
- [use-case-pattern.md](./use-case-pattern.md) — where `'use cache'` lives.
- [server-action-pattern.md](./server-action-pattern.md) — where `updateTag` lives.
- [error-handling.md](./error-handling.md) — `ActionResult` semantics.
- Next.js: [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components), [Data Fetching](https://nextjs.org/docs/app/getting-started/data-fetching).