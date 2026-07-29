# Pathfinder — Battle Map

Aplicación web para el Game Master de Pathfinder: arma un mapa sobre una grilla con tiles
personalizados, arrastra piezas para construir el escenario, y prepara el combate para una
pantalla integrada a la mesa de juego.

## Stack

- **Next.js 16** (App Router, Cache Components / PPR)
- **React 19.2**
- **react-konva** para el canvas interactivo
- **Prisma 7 + PostgreSQL** (vía `@prisma/adapter-pg`) para persistir escenarios
- **Zod v3** para validación de payloads (Server Actions y Server Components)
- **react-hook-form** + `@hookform/resolvers/zod` para formularios del editor
- **@fortawesome/react-fontawesome** para iconos
- **react-hot-toast** para notificaciones
- **Biome 2.5.5** como formatter y linter
- **pnpm 10.33.2** + Node `>=22`

Sin Tailwind, sin CSS-in-JS, sin Zustand. El estilado es CSS Modules exclusivamente (ver
`docs/patterns/css-modules.md`).

## Estructura

Pathfinder es una **single Next.js app**. Las rutas viven en la raíz del repo
(`app/`, `components/`, `hooks/`, `lib/`); `src/` aloja el motor de canvas y el
cliente de Prisma generado. El patrón Server Action → Use Case → Repository vive
en `lib/server/`. Ver `docs/architecture/folder-architecture.md` para el plan de
migración y `AGENTS.md` para el priority resolver.

```text
app/                           → App Router routes (TARGET stage)
  page.tsx, layout.tsx, globals.module.css
  admin/pieces/                → admin gallery
  editor/                      → editor + EditorClient + co-located hooks
components/                    → shared UI primitives (Button, Modal, Empty, form/)
hooks/                         → reusable client hooks (useReload, useStageViewport, usePieceMap, useSubdivisionMap)
lib/
  server/
    actions/                   → Server Actions (createAction contract)
    useCases/                  → plain-object async methods (cached reads lazy-import db)
    db/                        → Prisma singleton + repositories (factory around injected db/tx)
    utils/                     → server-side utils (e.g. runInTx)
  shared/
    schemas/                   → Zod schemas
    types/                     → z.infer types
    utils/                     → generateId, capitalize
    constants/                 → map dimensions, zoom bounds
    floors/                    → floor naming helpers (Planta Baja / Subsuelo N / Piso N)
src/
  assets/                      → generated piece catalog + image processor
  canvas/                      → Konva canvas: FloorStack, FloorCanvas, WorldGrid, traits, weather
  generated/                   → Prisma client output (gitignored)
prisma/                        → schema + migrations + seed
docs/                          → architectural contract (read before coding)
AGENTS.md                      → TOC + priority resolver
```

Las rutas activas son `/`, `/editor`, y `/admin/pieces`. Cache Components habilitado en
rutas dinámicas (`◐` en `pnpm build`).

## Comandos

Solo los scripts definidos en `package.json` (no hay `pnpm test` configurado):

```bash
pnpm dev                     # next dev
pnpm build                   # next build (incluye typecheck implícito)
pnpm start                   # next start (post-build)
pnpm typecheck               # tsc --noEmit
pnpm lint                    # biome lint (read-only)
pnpm lint:fix                # biome lint --write
pnpm format                  # biome format --write
pnpm check                   # biome check --write (lint + format)
pnpm gen-cat                 # regenera src/assets/data/catalog.ts desde piezas

# Prisma + DB
pnpm prisma:generate         # regenerar Prisma client
pnpm db:migrate:local        # prisma migrate dev + prisma db seed
pnpm db:migrate:prod         # prisma migrate deploy
pnpm db:studio:local         # prisma studio (local)
pnpm db:studio:prod          # prisma studio (prod)
pnpm db:reset                # migrate reset --force + generate
pnpm db:pr:reset             # lo mismo contra .env.production

pnpm clean                   # rm -rf node_modules .next
```

## Contrato operativo

**[`AGENTS.md`](./AGENTS.md)** es la fuente de verdad del proyecto. Cualquier cambio
sustancial tiene que pasar por ahí: lee los docs enlazados antes de diseñar código nuevo
o migrar código existente. Reglas críticas:

- Server Actions solo usan `updateTag` para invalidar cache (nunca `revalidateTag`).
- El árbol objetivo es `lib/shared/{schemas,types,utils}` + `lib/server/{actions,useCases,db/repository,utils}`. Sin shortcuts.
- Cache Components local (`'use cache'`), namespace `pathfinder:`.
- `pnpm lint` y `pnpm typecheck` son read-only. `pnpm format` y `pnpm check` escriben.
- Conventional commits: `feat | fix | refactor | test | docs | chore:` con scope.

## Alcance MVP

Incluido:

- Editor de mapa con grilla configurable (cellsize, width, height por piso)
- Múltiples pisos por escenario con switcher
- Snap-to-grid, zoom, pan
- Drag de piezas desde panel lateral (paleta)
- Subdivisión configurable (nombre, ratio de cell-size, set de piezas permitidas)
- Piezas con estados (open, closed, locked, on fire, etc.) y menú contextual
- Weather effects (fog, rain, snow, storm, night overlay)
- Persistencia de escenarios en PostgreSQL
- Seed automático de subdivisions por defecto (`pnpm db:migrate:local` corre `prisma db seed`)
- Catálogo de piezas base (`src/assets/data/catalog.ts` generado por `pnpm gen-cat`)

Fuera de alcance (per `AGENTS.md §11`):

- Auth / multi-tenancy
- Realtime (Soketi/pusher)
- File upload de packs externos (`.zip`)
- Pago
- Fichas de PJ/enemigos como entidad digital (son físicas en mesa)

## Estado del proyecto

El árbol `lib/`, `app/`, `components/`, `hooks/` ya está en uso. El canvas usa una pila de
`FloorCanvas` (uno por piso) + `WorldGrid` compartido + overlays. La Fase 4 alinea el
naming de CSS Modules al target (`kebab-case`) y unifica el quote style a single quotes.