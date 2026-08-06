# Pathfinder — Battle Map

Aplicación web para el Game Master de Pathfinder: arma un mapa sobre una grilla con tiles
personalizados, arrastra piezas para construir el escenario, divide el escenario en pisos
y maneja combate + hechizos sobre la misma pantalla que ven los jugadores.

## Stack

- **Next.js 16.3** (App Router, Cache Components / PPR)
- **React 19.2** con Server Components por defecto
- **react-konva** + **konva** para el canvas interactivo
- **Prisma 7** + **PostgreSQL** (driver adapter `@prisma/adapter-pg`) para persistir escenarios, combate y hechizos
- **Zod v3** para validar payloads de Server Actions y Server Components
- **react-hook-form** + `@hookform/resolvers/zod` para los formularios del editor
- **@fortawesome/react-fontawesome** para los iconos de la UI
- **react-hot-toast** para notificaciones
- **sharp** + **svgo** + **image-size** para el pipeline de piezas (`src/assets/scripts/generate-catalog.ts`)
- **Biome 2.5.7** como formatter y linter
- **pnpm 10.33.2** + Node `>=22` (`.nvmrc` fija 24)

Sin Tailwind, sin CSS-in-JS, sin Zustand. El estilado es **CSS Modules exclusivamente** (ver
`docs/patterns/css-modules.md`).

## Rutas

| Ruta | Descripción |
| --- | --- |
| `/` | Lista de escenarios. Carga vía `listScenarios` (RSC + cached read). Monta el `UnlockModal` cuando la sesión no está abierta. |
| `/editor?id=<scenarioId>` | Editor principal. `EditorClient` recibe `initialScenario` + `allPieces` y maneja autosave, undo, combate, hechizos, clima. |
| `/admin/pieces` | Galería administrativa de piezas. Lee `listAllPieces` (cached) y renderiza `PiecesGallery`. |
| `/ayuda` | Guía del editor generada desde `lib/shared/constants/shortcuts.ts`. Static-ish; el atajo `?` del editor apunta aquí. |

La home y el listado de piezas son públicos. El editor está protegido por una cookie de
sesión firmada con HMAC (`lib/server/auth/session.ts`) que se desbloquea con un password
configurado en `EDITOR_PASSWORD`. **No** es auth real ni multi-tenant — es un soft gate
local (ver `AGENTS.md §11`).

## Estructura

Pathfinder es una **single Next.js app**. Las rutas viven en la raíz del repo. El patrón
estricto es **Server Action → Use Case → Repository → Prisma** y se aplica en todo flujo
de datos de escritura.

```text
app/                            → App Router routes
  page.tsx, HomeClient.tsx, UnlockModal.tsx, globals.module.css
  admin/pieces/                 → galería administrativa
  ayuda/                        → guía in-app
  editor/                       → editor + EditorClient + co-located hooks
    components/                 → CombatModal, Compass, RoundViewer
    hooks/                      → use-history, use-ops-buffer, use-scenario-autosave,
                                  use-combat-ops, use-spell-ops, use-weather-session, …
components/                     → primitivos compartidos (Button, Modal, Empty,
                                  FloatingPanel, Popover, ShortcutsModal, Spinner,
                                  DisableContextMenu, NoFocusOnClick, form/*)
hooks/                          → hooks reutilizables (useViewportSize, usePanState,
                                  usePanModifier, usePieceMap, useSubdivisionMap,
                                  useStageViewport)
lib/
  server/
    actions/                    → Server Actions (contrato createAction)
    auth/                       → session.ts (cookie HMAC + isUnlocked)
    db/db.ts                    → singleton Prisma (TARGET location)
    db/repository/              → combat, effect, floor, paintedCell, scenario (factories)
    useCases/                   → combat, effect, piece, scenario (plain-object async)
    utils/                      → runInTx
  shared/
    constants/                  → brush, combat, darkness, floors, image-pipeline,
                                  keyboard, map, shortcuts, subdivisions, timing,
                                  validation, weather
    floors/                     → naming (Subsuelo N / Planta Baja / Piso N)
    schemas/                    → Zod por entidad (*.schemas.ts)
    types/                      → z.infer por entidad (*.types.ts)
    utils/                      → capitalize, generateId
src/
  assets/                       → catalog.ts (generado) + scripts/generate-catalog.ts
  canvas/                       → motor Konva: FloorStack, FloorCanvas × N,
                                  WorldGrid, tools (brush/erase/paint), traits
                                  (door-states, blocks-light, cells), weather
                                  (fog/rain/snow/storm), effects (blocked, footprint,
                                  spell-templates)
  generated/                    → Prisma client (gitignored, regenerado por pnpm prisma:generate)
prisma/                         → schema.prisma + migrations/
docs/                           → contrato arquitectónico (leer antes de codear)
AGENTS.md                       → TOC + priority resolver
```

El árbol `app/`, `components/`, `hooks/`, `lib/` ya está en la raíz; las cosas que aún
viven bajo `src/` son **migration debt** documentado en `AGENTS.md §12` (no se replica
como patrón).

## Setup

```bash
# 1. Dependencias
pnpm install

# 2. Variables de entorno — .env.example es el único archivo versionado
cp .env.example .env
#   DATABASE_URL     → PostgreSQL local
#   EDITOR_PASSWORD  → password del soft gate del editor
#   EDITOR_SECRET    → secreto HMAC para firmar la cookie (openssl rand -hex 32)

# 3. Migraciones (no hay seed: las subdivisiones son una constante en
#    lib/shared/constants/subdivisions.ts; ver prisma.config.ts)
pnpm db:migrate:local

# 4. Catálogo de piezas base (lee assets físicos y regenera src/assets/catalog.ts)
pnpm gen-cat

# 5. Dev
pnpm dev
```

Para regenerar el cliente Prisma después de tocar `prisma/schema.prisma`:
`pnpm prisma:generate`. El output va a `src/generated/prisma` y está gitignored.

## Comandos

Solo los scripts definidos en `package.json` — no hay `pnpm test` configurado.

```bash
pnpm dev                     # next dev (limpia .next primero)
pnpm build                   # next build (incluye typecheck implícito)
pnpm start                   # next start (post-build)
pnpm typecheck               # tsc --noEmit
pnpm lint                    # biome check .  (read-only)
pnpm lint:fix                # biome check --write .
pnpm format                  # biome format --write .
pnpm check                   # pnpm typecheck && pnpm lint
pnpm gen-cat                 # regenera src/assets/catalog.ts

# Prisma + DB
pnpm prisma:generate         # regenerar Prisma client
pnpm db:migrate:local        # prisma migrate dev
pnpm db:migrate:prod         # prisma migrate deploy
pnpm db:studio:local         # prisma studio (local)
pnpm db:studio:prod          # prisma studio (prod)
pnpm db:reset                # migrate reset --force + generate
pnpm db:pr:reset             # lo mismo contra .env.production

pnpm clean                   # rm -rf node_modules .next
```

## Arquitectura en 60 segundos

**Server Action** (`'use server'`, envuelve el handler con `createAction`):
parsea el Zod schema, inyecta `db`/`tx` perezoso solo en escrituras, normaliza la respuesta
al envelope canónico `ActionResult<T>` y formatea los issues de Zod como `path 🡆 message`.

**Use Case** (`lib/server/useCases/*`, objeto plano, sin `'use server'`):
los **reads cacheados** no reciben `db` — importan el singleton desde `@/lib/server/db/db`
dentro del módulo y aplican `'use cache'` + `cacheLife` + `cacheTag` (namespace
`pathfinder:`). Las **escrituras** reciben `db`/`tx` como primer parámetro y se ejecutan
dentro de `runInTx` cuando es necesario.

**Repository** (`lib/server/db/repository/*`, factory alrededor de `db` inyectado):
solo Prisma, DTOs adentro y afuera, cero fugas de tipos generados hacia features.

**Entity split de 5 archivos** (`docs/architecture/entity-file-pattern.md`):
cada entidad se divide en `*.schemas.ts | *.types.ts | *.repository.ts | *.usecases.ts
| *.action.ts`. Los directorios actuales siguen este patrón para `combat`, `effect`,
`floor`, `paintedCell`, `piece`, `scenario` (+ `scenarioOp` y `subdivision` como
soporte).

**Mutaciones op-merged (combate + hechizos)** (`docs/architecture`):
`Combat` y `ScenarioEffect` se mutan vía `ScenarioOp` (`addCombatant`, `removeCombatant`,
`startCombat`, `endCombat`, `nextTurn`, `previousTurn`, `advanceRound`, `addEffect`,
`removeEffect`). El replay corre en `scenario.repository.applyOpsInTx`. No hay Server
Action dedicada por entidad porque el pipeline de autosave es el único canal de mutación
y un segundo canal partiría la misma fila en dos TXs. Los reads siguen el patrón
regular (`combatUseCases.findByScenario`, `effects` viaja dentro de
`LoadScenarioResult.effects`).

**Cache Components**:
`'use cache'` local (sin remote cache handler aún); namespace `pathfinder:` para todas
las tags. Server Actions usan `updateTag` (read-your-own-writes) y nunca `revalidateTag`
— ese API queda reservado para Route Handlers / webhooks futuros. `revalidatePath` se
usa solo para invalidación a nivel de ruta. Las rutas dinámicas se renderizan parciales
(`◐` en `pnpm build`).

## Motor de canvas

`src/canvas/` es el motor Konva cliente-only. La composición canónica es:

- `FloorStack` renderiza una pila de `FloorCanvas` (uno por piso) + un `WorldGrid`
  compartido. Solo se renderizan los pisos **desde el inicio del array hasta el piso
  activo inclusive** (`useVisibleFloors` es la fuente de verdad). El orden por defecto es
  bottom→top (`Subsuelo 1`, `Planta Baja`, `Piso 1`), así que el slice mantiene los
  pisos en o por debajo del activo.
- `FloorCanvas` recibe el layer `Konva`, los handlers de pointer/teclado
  (`useCanvasEventHandlers`, `usePaintStroke`) y delega a `tools/` (`paint`, `erase`,
  `brush`) según la herramienta activa.
- `EffectsLayer` monta los markers de hechizos + overlays de clima (`FogEffect`,
  `RainEffect`, `SnowEffect`, `StormEffect`); los hechizos consultan `spell-templates.ts`
  en render-time para resolver forma, color y dimensiones.
- Los `traits/` (registry + `StateMenu`) aportan estados mutables a las celdas pintadas
  (puertas: `open` / `closed` / `locked`, etc.) y viven en la columna `entityState` de
  `PaintedCell`.

El canvas consume piezas vía `useTextureImages` (lee del catálogo generado por
`pnpm gen-cat`) y subdivisiones vía la constante `SUBDIVISIONS`.

## Editor a vista de GM

- **Grilla configurable** por escenario (`baseCellSize`, `width`, `height`).
- **4 subdivisiones fijas**: `Suelo`, `Objetos grandes`, `Objetos pequeños`,
  `Estructuras`. Cada subdivisión tiene su propia grilla y solo pintás en la activa
  (teclas `1..4`).
- **Pisos apilables** (Subsuelo N / Planta Baja / Piso N) con switcher y atajos
  `⇧+↑` / `⇧+↓`.
- **Herramientas**: pintar, borrar, oscuridad, hechizos. Pincel con tamaño (`[` / `]`)
  y forma circular/cuadrada (`⇧+B`).
- **Estados de piezas**: click derecho sobre una celda pintada abre el menú del trait
  correspondiente (puertas, etc.).
- **Combate**: tracker persistente 1:1 con el escenario (`Combat`), combatientes con
  iniciativa + lado, ronda actual, cursor de turno. Atajos `N` (siguiente), `J`
  (anterior), `R` (forzar ronda), `C` (modal de combate).
- **Hechizos**: 5 templates hardcodeados (Cono 15, Cono 30, Radio 5, Radio 10,
  Radio 20). Rotación en canvas (`Q` o click derecho sobre celda vacía). Duración en
  rondas PF1e — el server decrementa en el wrap de ronda y borra los que llegan a 0.
  Al finalizar el combate, cascade-delete limpia todo.
- **Autosave**: cada 60 s si hubo cambios, más `Ctrl+S` manual.
- **Undo / redo**: pila en memoria (`Ctrl+Z` / `Ctrl+⇧+Z`). Solo aplica a paint, erase,
  darkness y clear — agregar/quitar pisos, renombrar, abrir/cerrar puertas, combate y
  hechizos aún no entran en la pila.
- **Clima y audio**: local a la sesión, no se persiste.
- **Atajos de teclado**: definidos una sola vez en
  `lib/shared/constants/shortcuts.ts` y consumidos por el editor, el modal de atajos y
  la página `/ayuda`.

El detalle operativo está en `/ayuda` (in-app) y en `EDITOR_GUIDE.md`.

## Convenciones y contrato

**[`AGENTS.md`](./AGENTS.md)** es la fuente de verdad. Cualquier cambio sustancial pasa
por ahí. Antes de tocar código nuevo o migrar existente, leer los docs enlazados en
[`docs/README.md`](./docs/README.md). Reglas críticas:

- Server Actions: solo `updateTag` para invalidar cache (nunca `revalidateTag`).
- Árbol TARGET: `lib/shared/{schemas,types,utils}` + `lib/server/{actions,useCases,db/repository,utils}`.
  El código nuevo va acá; lo que aún vive en `src/app/actions/` o `src/pieces/` es
  migration debt.
- Cache Components local (`'use cache'`), namespace `pathfinder:` para `cacheTag`.
- `pnpm lint` y `pnpm typecheck` son read-only. `pnpm format` y `pnpm check` escriben.
- Conventional commits: `feat | fix | refactor | test | docs | chore:` con scope.
- Biome apunta a single quotes + kebab-case CSS Modules (TARGET style); la deuda actual
  de quotes está en `docs/patterns/code-style.md`.

## Alcance MVP

**Incluido:** editor de mapa con grilla configurable; subdivisiones (4 fijas);
pisos apilables; snap-to-grid, zoom, pan; drag de piezas desde el panel; estados
mutables por pieza (puertas); weather effects (fog, rain, snow, storm, night
overlay); persistencia de escenarios + combate + hechizos en PostgreSQL; tracker de
combate persistente; 5 templates de hechizos con duración en rondas; autosave;
undo/redo en memoria; catálogo de piezas base generado por `pnpm gen-cat`.

**Fuera de alcance** (per `AGENTS.md §11`): auth real / multi-tenancy; realtime
(Soketi/pusher); upload de packs externos (`.zip`); pago; fichas de PJ/enemigos
como entidad digital (son físicas en mesa).

## Estado de migración

Pathfinder está **mid-migration** entre el árbol anterior bajo `src/` y el TARGET
en raíz. Hoy conviven ambos lados; las cosas nuevas van siempre al TARGET. La deuda
concreta (carpetas/archivos aún en `src/`, `useReload` eliminado, split de
`useStageViewport`, etc.) está listada en `AGENTS.md §12` y no se aborda en este
README — cada `docs/architecture/*.md` cierra con su propia nota **CURRENT vs
TARGET** para que el lector nunca confunda el path de hoy con el de mañana.