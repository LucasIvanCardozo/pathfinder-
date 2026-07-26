# Folder Architecture

Pathfinder is a single Next.js App Router app. Server boundary lives at the Server Action; everything below is plain TypeScript.

## Decision

The TARGET tree is **literal root-level**, mirroring the reference repo's shape but slimmed to Pathfinder's actual needs. The TARGET infrastructure singleton lives at `lib/server/db/db.ts`; CURRENT code still uses `src/db/client.ts`.

```text
app/                            → Next.js App Router routes (page, layout, error, not-found)
components/
  Features/                     → feature-shaped composites (Editor, Home, Admin)
  UI/                           → atomic UI primitives (Button, Modal, Toast, Icons)
  Layouts/                      → composed layout shells
contexts/Providers/             → React Context providers (Toast, Modal, Theme)
hooks/                          → reusable client hooks
lib/
  server/
    actions/                    → thin Server Actions via createAction (new work goes here)
    useCases/                   → plain-object business logic
    db/
      db.ts                     → TARGET Prisma singleton (CURRENT: src/db/client.ts)
      repository/               → Prisma-only data access
    utils/                      → server-only helpers (runInTx, etc.)
  shared/
    schemas/                    → Zod schemas, one file per entity (*.schemas.ts)
    types/                      → inferred + DTO types (*.types.ts)
    utils/                      → framework-agnostic helpers
src/pieces/                     → [TRANSITIONAL] domain pieces still living here
src/db/client.ts                → [TRANSITIONAL, CURRENT] Prisma client singleton
src/app/actions/                → [TRANSITIONAL] existing action files; new work goes to lib/server/actions/
prisma/                         → schema + migrations (stays at root)
```

## Rules

| Folder | Rule |
|--------|------|
| `app/` | Routes only. `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx`. No business logic. |
| `components/Features/` | Feature composites that read actions + use cases. Client or Server as needed. |
| `components/UI/` | Atomic primitives. No fetches, no actions. Importable from any layer. |
| `components/Layouts/` | Route shells. Wrap children, accept slot props. |
| `contexts/Providers/` | One file per provider. Providers compose in `app/layout.tsx`. |
| `hooks/` | Client-only hooks (`use client`). Server code must not import from here. |
| `lib/server/actions/` | Every file starts with `'use server'`. One file per entity, named `*.action.ts`. **New work goes here**; `src/app/actions/` is migration debt. |
| `lib/server/useCases/` | Plain-object export, no `'use server'`, no class. Cached reads import the singleton at module scope; writes accept `db`. |
| `lib/server/db/db.ts` | TARGET infrastructure singleton. CURRENT lives at `src/db/client.ts`. |
| `lib/server/db/repository/` | Prisma calls only. Returns DTOs, never Prisma model instances. |
| `lib/shared/schemas/` | Zod schemas. Per-entity, named `*.schemas.ts`. |
| `lib/shared/types/` | `z.infer` outputs and DTOs. Per-entity, named `*.types.ts`. |
| `lib/shared/utils/` | Pure helpers. No Prisma, no Next imports. |
| `prisma/` | Schema, migrations, seed. Stays at the project root. |

## Quick path (add a new entity)

1. `lib/shared/schemas/<entity>.schemas.ts` — Zod.
2. `lib/shared/types/<entity>.types.ts` — `z.infer` and DTOs.
3. `lib/server/db/repository/<entity>.repository.ts` — Prisma queries.
4. `lib/server/useCases/<entity>.usecases.ts` — business rules.
5. `lib/server/actions/<entity>.action.ts` — `createAction` entrypoint.
6. `components/Features/<Entity>/` — UI composites that call the action.

## Anti-patterns

- Putting Server Actions in `app/`, `components/`, or `lib/shared/`.
- Importing `@/db` or `@/generated/prisma/*` from `components/`, `hooks/`, or `contexts/`.
- Passing a Prisma model instance across a Server Action boundary; convert to a DTO first.
- Mixing business logic and Prisma calls inside a Server Action file.
- Defining routes in `src/app/` after migration; `src/app/` becomes empty during the move.
- Putting plain `.css` files next to a component when the target is CSS Modules.

## CURRENT vs TARGET

Pathfinder is mid-migration. Today's code lives in `src/`:

| CURRENT path | TARGET path |
|--------------|-------------|
| `src/app/` (App Router routes) | `app/` |
| `src/app/components/form/*` | `components/UI/Form*` |
| `src/app/components/SubdivisionManager.tsx` | `components/Features/SubdivisionManager/` |
| `src/app/actions/scenarios.ts` | `lib/server/actions/scenario.action.ts` |
| `src/app/actions/subdivisions.ts` | `lib/server/actions/subdivision.action.ts` |
| `src/pieces/{types,schemas,traits}.ts` | `lib/shared/{types,schemas}/piece.{types,schemas}.ts` |
| `src/db/client.ts` | `lib/server/db/db.ts` (infrastructure singleton) |
| `src/app/globals.css`, `home.css`, `*.css` | `app/globals.module.css` + per-component `*.module.css` |

`src/pieces/` and `src/db/` are transitional; **new entities must not be added there**. **New Server Actions, repositories, and use cases go to TARGET `lib/server/actions/`, `lib/server/useCases/`, and `lib/server/db/repository/` respectively.** `src/app/actions/` is migration debt for existing files only — it is not a place for new work. Each pattern doc shows the literal mapping for files that still live in `src/`.

## Related

- [entity-file-pattern.md](./entity-file-pattern.md) — what each file inside the layout is named.
- [server-action-pattern.md](./server-action-pattern.md) — actions live in `lib/server/actions/`.
- [css-modules.md](../patterns/css-modules.md) — CSS Modules; the only allowed style author entry.
- Next.js: [Project Structure](https://nextjs.org/docs/app/getting-started/project-structure).