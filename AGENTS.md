# AGENTS.md — Pathfinder

Operating contract for agent work. Detailed rules live in `docs/`; this file is a TOC and the priority resolver. Keep it under 150 lines.

## 1. Priority

1. User instructions override this file.
2. This file overrides the README and informal repository conventions.
3. When unclear, inspect existing patterns before designing a new one.
4. **Pattern consistency:** use one approved pattern across the app; do not create one-off variants.

These rules apply to all code from today. Existing violations are temporary migration debt, not a reason to add more violations. This session does not refactor them.

## 2. Project and stack

Pathfinder is a single Next.js App Router application for a game-master battle-map editor. It is not currently a monorepo or multi-tenant system.

- **Framework:** Next.js 16, React 19.2, Cache Components enabled.
- **Language:** TypeScript strict mode with `noUncheckedIndexedAccess`.
- **Data:** PostgreSQL through Prisma 7 and `@prisma/adapter-pg`.
- **Forms:** react-hook-form + `@hookform/resolvers/zod` + Zod v3.
- **Notifications:** react-hot-toast (user-owned package diff).
- **Icons:** FontAwesome via `@fortawesome/react-fontawesome` + `@fortawesome/free-solid-svg-icons` (user-owned package diff).
- **Canvas:** react-konva/Konva, client-only.
- **Style:** CSS Modules exclusively — see [css-modules.md](./docs/patterns/css-modules.md).
- **Tooling:** Biome 2.5.5, pnpm 10.33.2, Node `>=22`.

## 3. Commands

Use only scripts that exist in `package.json`: `pnpm dev | build | start | typecheck | lint | lint:fix | format | check | gen-cat | prisma:generate | db:migrate:local | db:migrate:prod | db:studio:local | db:studio:prod | db:reset | db:pr:reset`. There is **no configured test runner or `pnpm test`**; do not claim test coverage that does not exist.

## 4. Documentation map (TOC)

Read these before designing new code or migrating existing code. Each doc is concise and ends with a CURRENT vs TARGET note.

- Docs index: [docs/README.md](./docs/README.md).
- Architecture: [folder-architecture.md](./docs/architecture/folder-architecture.md), [entity-file-pattern.md](./docs/architecture/entity-file-pattern.md), [server-action-pattern.md](./docs/architecture/server-action-pattern.md), [use-case-pattern.md](./docs/architecture/use-case-pattern.md), [repository-pattern.md](./docs/architecture/repository-pattern.md), [cache-tag-convention.md](./docs/architecture/cache-tag-convention.md), [data-fetching.md](./docs/architecture/data-fetching.md), [error-handling.md](./docs/architecture/error-handling.md).
- Patterns: [forms.md](./docs/patterns/forms.md), [icons.md](./docs/patterns/icons.md), [code-style.md](./docs/patterns/code-style.md), [css-modules.md](./docs/patterns/css-modules.md).

## 5. Target folder layout (root-level)

Pathfinder is mid-migration to a literal root-level tree; today's code is under `src/`. The TARGET tree is:

```text
app/                            → App Router routes
components/{Features,UI,Layouts} → feature composites, primitives, shells
contexts/Providers/             → React Context providers
hooks/                          → reusable client hooks
lib/server/{actions,useCases,db/repository,utils}
lib/shared/{schemas,types,utils}
prisma/                         → schema + migrations
```

Until the move happens, the CURRENT transitional tree is `src/app/` (routes + components + actions), `src/pieces/` (domain types, schemas, traits), `src/db/client.ts` (Prisma client singleton, CURRENT), and `src/canvas/`. The TARGET Prisma singleton lives at `lib/server/db/db.ts`. The five-file entity split (`*.schemas.ts | *.types.ts | *.repository.ts | *.usecases.ts | *.action.ts`) is the target shape — do not introduce a third file pattern. See [folder-architecture.md](./docs/architecture/folder-architecture.md) and [entity-file-pattern.md](./docs/architecture/entity-file-pattern.md).

## 6. Server Action → Use Case → Repository

Each layer calls only the layer below it:

```text
Server Action ('use server') → Use Case → Repository → Prisma
```

- **Actions** wrap handlers with `createAction` from `lib/server/actions/createAction.ts`. See [server-action-pattern.md](./docs/architecture/server-action-pattern.md) for the exact contract: schema parse, lazy DB injection into writes only, handler context, normalised `ActionResult`, Zod formatting, generic error handling, optional transaction DB provider.
- **Use cases** export a plain object of async methods; no `'use server'`, no classes. **Cached reads do not receive a `db`/`PrismaClient` argument** — they import the server singleton from `@/lib/server/db/db` (CURRENT `@/db`) inside the use-case module and call the repository with it. **Writes accept `db`/`tx` as their first parameter.** Cached reads place `'use cache'`, `cacheLife`, `cacheTag` at the start of the function. See [use-case-pattern.md](./docs/architecture/use-case-pattern.md).
- **Repositories** are factories around injected `db`/`tx`; Prisma queries only; DTOs in and out. The TARGET infrastructure singleton is `lib/server/db/db.ts`; CURRENT is `src/db/client.ts`. Feature code must not import generated Prisma types directly. See [repository-pattern.md](./docs/architecture/repository-pattern.md).

Do not pass Prisma model instances across this boundary or keep mutable request state at module scope.

## 7. Action results and control flow

The canonical envelope (Carta QR target) is exactly:

```ts
type ActionResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { message: string; cause?: string } };
```

`createAction` is the only place that produces this envelope: it parses the Zod schema, formats every Zod issue as `path 🡆 message` joined by newlines into `error.message`, wraps the callback's returned value as `data`, and catches thrown errors. Handlers return the **domain value** on success (the wrapper wraps it) and **throw a safe error** for known domain/action failures (the wrapper normalises it). Do not construct the envelope by hand inside the handler. The canonical envelope has **no `fieldErrors`**; UI parses the `path 🡆 message` lines from `error.message` to map per-field errors. `redirect()` and `notFound()` are unwrapped Next.js framework control flow — redirecting actions stay outside `createAction` and return `Promise<never>`. Carta QR's future `createProtectedAction` defines its own custom `unauthorized` / `forbidden` auth errors that are **not** framework control flow: they are normalised by the inner `createAction` wrapper into the canonical `{success: false, data: null, error: ...}` envelope. See [error-handling.md](./docs/architecture/error-handling.md).

## 8. Cache tags and invalidation

The full tag inventory and the prefix rules live in [cache-tag-convention.md](./docs/architecture/cache-tag-convention.md); AGENTS.md does not duplicate it. Use the `pathfinder:` namespace exclusively. `'use cache'` (local) is the current variant — Pathfinder does not yet configure a remote cache handler. All directives (`'use cache'`, `cacheLife`, `cacheTag`) live at the start of the cached function in one consistent order. Use `cacheTag` in cached reads; `updateTag` in Server Actions for read-your-own-writes. **Server Actions must never use `revalidateTag`** — that API is reserved for future non-action contexts (Route Handlers, webhooks, jobs). Use `revalidatePath` for route-level invalidation. **Reads must not mutate** — `listSubdivisions`'s `ensureDefaultSubdivisions` must move to a one-time seed use case before that read can be cached.

## 9. Forms, RSC, and styles

- **Forms** — react-hook-form + Zod resolver, one `useForm` per root, `FormProvider` for composition, primitives via `useFormContext`. Subscribe narrowly with `useWatch({ control, name })`. Schemas at module scope. See [forms.md](./docs/patterns/forms.md).
- **RSC boundaries** — Server Components by default; `'use client'` only for state, effects, browser APIs, or event handlers. Konva is client-only. Never pass Prisma instances to client components.
- **Style** — CSS Modules exclusively per component; one `app/globals.module.css` with explicit `:global` reset and `:root` tokens (including `--grid`); no plain CSS, Tailwind, or CSS-in-JS; static inline styles are forbidden, runtime-computed single values may use CSS variables or `data-*` attributes. See [css-modules.md](./docs/patterns/css-modules.md).
- **Icons** — FontAwesome from `@fortawesome/free-solid-svg-icons` via `<FontAwesomeIcon>`; never inline SVG. See [icons.md](./docs/patterns/icons.md).

## 10. Quality and conventions

Biome 2.5.5 is configured for single quotes (target style), semicolons, trailing commas, 100-character lines, 2-space indentation, organized imports. `pnpm lint` and `pnpm typecheck` are read-only; `pnpm format` and `pnpm check` write files. Use PascalCase for components, kebab-case for non-component files/styles, `@/*` imports. English for code, identifiers, schemas, and technical comments; preserve Spanish user-facing copy. Conventional commits: `feat | fix | refactor | test | docs | chore:` with a scope. See [code-style.md](./docs/patterns/code-style.md).

### Comment budget
- JSDoc on public functions: 3-5 lines max (header + why + at most one edge case).
- Inline comments: 2-3 lines max, ideally 1-2.
- Post-mortems for past bugs: up to 10 lines OK; regression knowledge is worth it.
- `// FRAGILE` / `// NOTE` annotations: 1-3 lines.
- If the "why" needs more than 5 lines, refactor the code so the "why" is self-evident.

### Floor rendering rule
Only floors from the start of the `floors` array up to and including the active floor render — i.e. `floors.slice(0, activeIndex + 1)`. Floors above the active one (indices `> activeIndex`) are **not** rendered and would otherwise visually sit on top of the active floor and hide it. The default floor order is bottom→top (`Subsuelo 1`, `Planta Baja`, `Piso 1`), so the slice keeps floors at or below the active one. The `useVisibleFloors` hook is the single source of truth for this slice.

## 11. Explicit scope boundaries

Pathfinder has **no authentication, no multi-tenancy, no realtime (Soketi/pusher), no payment processing, and no file-upload service**. `createProtectedAction` (the auth-extended wrapper) and the `venue:` cache tag convention are out of scope until an auth provider is added. Do not copy those concerns from the reference repo. Rate limiting is manual/opt-in, not automatic, in `createAction`. Introduce new infrastructure only through an explicit architectural decision documented in `docs/architecture/`.

## 12. Migration debt

Known non-compliant areas: `src/app/actions/{scenarios,subdivisions}.ts` use direct Prisma + mixed result contracts (transitional; new work goes to TARGET `lib/server/actions/`, not `src/app/actions/`); `src/canvas/weather/WeatherPanel.tsx` uses whole-form `methods.watch`; `src/app/components/SubdivisionManager.tsx` uses inline `watch("pieceIds")`; ID generation was duplicated in `src/app/actions/scenarios.ts` and `src/app/editor/EditorClient.tsx` (now centralised in `lib/shared/utils/generateId.ts`); `src/db/client.ts` and `src/pieces/{types,schemas,traits}.ts` are transitional; the empty `src/components/` and `src/app/components/forms/` directories and unused `eslint.config.mjs` need cleanup; `README.md` describes an aspirational monorepo instead of the current single-app tree. The plain-CSS files (`src/app/*.css`, `src/canvas/**/*.css`) migrate to CSS Modules. Recent cleanups: `app/admin/pieces/page.tsx` now owns its own `page.module.css` (was borrowing from `app/page.module.css`); `src/canvas/components/FloorCanvas.tsx` and `app/editor/EditorClient.tsx` were extracted into smaller hooks and modules; `hooks/useStageViewport.ts` was split into `useViewportSize`, `useSpaceKey`, `usePanState`; the `@/canvas` barrel was pruned to the symbols actually consumed externally; the dead `components/Modal.tsx` and `hooks/useReload.ts` were deleted; `lib/shared/constants/catalog.ts` was renamed to `image-pipeline.ts` to match its contents. Do not turn this list into an unrelated refactor; when changing a listed area, migrate it toward the docs above before adding new behavior.