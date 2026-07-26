# Pathfinder Docs

Operating contract for Pathfinder, a single Next.js App Router app for a game-master battle-map editor. This directory is the **source of truth** for architecture, patterns, and conventions. `AGENTS.md` is the table of contents.

## Architecture (`docs/architecture/`)

| Doc | Purpose |
|-----|---------|
| [folder-architecture.md](./architecture/folder-architecture.md) | CURRENT `src/` tree vs TARGET root-level tree; where each layer lives; `lib/server/db/db.ts` (TARGET) vs `src/db/client.ts` (CURRENT). |
| [entity-file-pattern.md](./architecture/entity-file-pattern.md) | Per-entity five-file split: `*.schemas.ts`, `*.types.ts`, `*.repository.ts`, `*.usecases.ts`, `*.action.ts`. |
| [server-action-pattern.md](./architecture/server-action-pattern.md) | `createAction` contract: schema parse, lazy DB injection into writes, canonical `ActionResult` envelope, Zod formatting into `path 🡆 message`, safe-error normalisation. |
| [use-case-pattern.md](./architecture/use-case-pattern.md) | Plain-object use cases, no `'use server'`, transactional helper, cached reads take no `db` (singleton inside module), writes take `db`/`tx`. |
| [repository-pattern.md](./architecture/repository-pattern.md) | Prisma-only factories; DTOs in/out; no cross-layer leakage; singleton lives at `lib/server/db/db.ts`. |
| [cache-tag-convention.md](./architecture/cache-tag-convention.md) | `pathfinder:` namespace, full authoritative tag inventory, `cacheTag` in reads, `updateTag` in Server Actions (never `revalidateTag` in actions); `listSubdivisions` mutation caveat. |
| [data-fetching.md](./architecture/data-fetching.md) | RSC + cached reads call use cases (never Prisma); Server Actions for mutations; route-level `revalidatePath` + `updateTag`. |
| [error-handling.md](./architecture/error-handling.md) | Canonical `ActionResult` discriminated union (Carta QR), `path 🡆 message` format, redirect/control-flow exceptions as `Promise<never>`, logging rules. |

## Patterns (`docs/patterns/`)

| Doc | Purpose |
|-----|---------|
| [forms.md](./patterns/forms.md) | react-hook-form + Zod resolver, `FormProvider`, `useFormContext`, narrow `useWatch`; map `result.error.message` (no `fieldErrors`). |
| [icons.md](./patterns/icons.md) | FontAwesome from `@fortawesome/free-solid-svg-icons`; no inline SVG. |
| [code-style.md](./patterns/code-style.md) | Biome rules (CURRENT double quotes) vs TARGET single quotes; naming; Spanish user-facing copy; conventional commits. |
| [css-modules.md](./patterns/css-modules.md) | CSS Modules exclusively; one global `globals.module.css` entry with `:global`; `:root` tokens include `--grid`. |

## Quick path for new contributors

1. Read `AGENTS.md` for the priority rules and current state.
2. Read [folder-architecture.md](./architecture/folder-architecture.md) to find the right folder.
3. Read [entity-file-pattern.md](./architecture/entity-file-pattern.md) to lay out a new domain entity.
4. Read [server-action-pattern.md](./architecture/server-action-pattern.md) and [use-case-pattern.md](./architecture/use-case-pattern.md) for any mutation.
5. Read [cache-tag-convention.md](./architecture/cache-tag-convention.md) before adding any `'use cache'` directive.
6. Read [code-style.md](./patterns/code-style.md) for the TARGET quote style (single quotes) and the CURRENT Biome double-quote debt.

## Current vs target

Pathfinder is mid-migration. The CURRENT code lives under `src/` (App Router at `src/app/`, source code at `src/`, domain code at `src/pieces/`, `src/db/`). The TARGET tree moves to the root with `app/`, `components/{Features,UI,Layouts}`, `contexts/Providers`, `hooks`, `lib/server/{actions,useCases,db,utils}` (with the Prisma singleton at `lib/server/db/db.ts`), and `lib/shared/{schemas,types,utils}`. Each architecture doc ends with a **CURRENT vs TARGET** note so the reader never confuses today's path with the future one. New Server Actions, repositories, and use cases belong in the TARGET `lib/server/` tree — the transitional `src/app/actions/` is migration debt, not a place for new work.

## Scope boundaries

Pathfinder has no authentication, no multi-tenancy, no realtime (Soketi/pusher), no payment, and no file-upload service. Do not copy those concerns from the reference repo. Introduce them only through an explicit architectural decision.