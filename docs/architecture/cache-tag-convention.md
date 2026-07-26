# Cache Tag Convention

Pathfinder namespaces all cache tags with `pathfinder:` so they are easy to grep and never collide with framework or vendor tags.

## Decision

```text
pathfinder:scenarios
pathfinder:scenario:{id}
pathfinder:subdivisions
pathfinder:subdivision:{id}
pathfinder:pieces
pathfinder:piece:{id}
pathfinder:floors
pathfinder:floor:{id}
pathfinder:painted-cells
```

| Pattern | Used for |
|---------|----------|
| `pathfinder:<entity>` (plural noun) | List / collection caches. |
| `pathfinder:<entity>:{id}` | Single-entity caches. |

**Prefix rules**

- Always start with `pathfinder:`. Bare entity names are forbidden.
- The entity suffix is a **plural noun** (`scenarios`, `subdivisions`), never a singular.
- IDs are interpolated, never concatenated with extra punctuation.
- A new entity tag must be added here before any code tags it.

## `use cache` placement

Pathfinder uses local cache only today:

```ts
'use cache';
cacheLife('hours');
cacheTag('pathfinder:scenarios');
```

`'use cache: remote'` requires a Redis/KV cache handler that Pathfinder does not yet configure. Do not use the remote variant until the cache handler is added; the local directive is enough for the single-instance deployment.

### Cache directive order

```ts
async function getAll() {
  'use cache';          // 1. directive
  cacheLife('hours');   // 2. lifetime
  cacheTag('pathfinder:scenarios'); // 3. tags
  return scenarioUseCases.list();
}
```

The `'use cache'` → `cacheLife` → `cacheTag` order is a **Pathfinder readability convention, not a Next.js requirement**: Next.js does not mandate the relative order of `cacheLife` and `cacheTag`. What is required is that all directives live at the **start of the function body** in a consistent order so they are visible at a glance and impossible to miss. Do not place any other statement before them.

## Invalidation

| API | Where | Behavior |
|-----|-------|----------|
| `cacheTag(tag)` | Inside a `'use cache'` function | Tags the cache entry so it can be invalidated later. |
| `updateTag(tag)` | Inside a Server Action that mutates | Immediate invalidation; same request sees fresh data. Reserved for the read-your-own-writes pattern. **The only mutation-time invalidation API in a Server Action.** |
| `revalidateTag(tag, 'max')` | Route Handlers, webhooks, jobs (future, non-action only) | Background stale-while-revalidate; **never call from a Server Action.** |
| `revalidatePath(path)` | After a mutation that changes route output | Route-level invalidation (e.g. `revalidatePath('/')` after `saveScenario`). |

### Which one to call

- **Server Action mutation** → `updateTag` for tag-based freshness + `revalidatePath` if the affected page tree changed. **Server Actions must never use `revalidateTag`; the only mutation-time invalidation API is `updateTag`.**
- **Future Route Handler / webhook / cron** → `revalidateTag(tag, 'max')` is allowed in those non-action contexts. Not needed today because Pathfinder has none.
- **Route-level invalidation only** → `revalidatePath('/editor')` is fine when no tag exists for the affected data.

## listSubdivisions must stop mutating

`listSubdivisions` (CURRENT: `src/app/actions/subdivisions.ts`) currently calls `ensureDefaultSubdivisions()` on every read. **A read that mutates cannot be cached** — the cache key would not include the mutation, and the side effect would silently happen once and never again.

Before adding `'use cache'` to a subdivision read:

1. Move seeding to a one-time bootstrap use case (`subdivisionUseCases.seedDefaults(db)`) called from app start, a Prisma seed script, or an explicit admin action — never from a read.
2. Make the read path pure: `subdivisionUseCases.list()` returns `subdivisionRepository(db).findAll()` with `cacheTag('pathfinder:subdivisions')` (the cached read imports the server singleton inside the module; no `db` argument).
3. Mutations call `updateTag('pathfinder:subdivisions')` so cached reads see fresh data.

## Quick path

1. Inside the read function, place `'use cache'`, `cacheLife`, and `cacheTag` at the very top in that order.
2. Inside the action that mutates the same entity, call `updateTag` (and `revalidatePath` if the route changed).
3. Verify no read path mutates; if it does, refactor first.

## Anti-patterns

- A read that calls `create`, `update`, `delete`, or any side-effecting Prisma method. Move the side effect to a use case called from a mutation or a seed script.
- Bare tags like `scenarios`, `Scenarios`, `scenario-list`.
- Inventing a new tag string without updating the inventory above. AGENTS.md links here; the inventory is authoritative.
- `'use cache'` inside a function that calls `cookies()` or `headers()`. Pass those values as arguments instead, or use `'use cache: private'` (Pathfinder has no compliance need for the private variant today).
- `revalidateTag` from inside a Server Action. The only mutation-time invalidation API in a Server Action is `updateTag`; `revalidateTag` is reserved exclusively for future non-action contexts (Route Handlers, webhooks, jobs).
- Tagging every cached call with per-instance tags like `pathfinder:scenario:${id}` when the list tag would suffice. Use the narrow tag only for entity detail pages.

## CURRENT vs TARGET

The CURRENT code does not use `'use cache'`. The first cached read should be the new `listSubdivisions` (after the mutation caveat above). Today's invalidation strategy uses `revalidatePath('/')` and `revalidatePath('/editor')` exclusively.

| CURRENT call | TARGET replacement |
|--------------|-------------------|
| `revalidatePath('/')` inside `saveScenario` | `updateTag('pathfinder:scenarios')` + `updateTag('pathfinder:scenario:{id}')` + `revalidatePath('/')` if the home page changed. |
| `revalidatePath('/editor')` inside subdivision mutations | `updateTag('pathfinder:subdivisions')`. `revalidatePath('/editor')` only if subdivision shape affects the editor chrome. |
| `revalidatePath('/')` inside `deleteScenario` | `updateTag('pathfinder:scenarios')` + `updateTag('pathfinder:scenario:{id}')`. |

## Related

- [use-case-pattern.md](./use-case-pattern.md) — read use cases carry `'use cache'`.
- [data-fetching.md](./data-fetching.md) — when to read from cache vs fetch.
- [server-action-pattern.md](./server-action-pattern.md) — actions call `updateTag`.
- Next.js: [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache), [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag).
