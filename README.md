# Pathfinder — Battle Map

Aplicación web para el Game Master de Pathfinder: arma un mapa sobre una grilla con tiles
personalizados, arrastra piezas para construir el escenario, y prepara el combate para una
pantalla integrada a la mesa de juego.

## Stack

- **Next.js 16** (App Router, Cache Components / PPR)
- **React 19.2**
- **react-konva** para el canvas interactivo
- **Zustand** para el estado del editor
- **Prisma + PostgreSQL** (Neon) para persistir escenarios
- **Turborepo + pnpm** como monorepo

## Estructura

```
apps/
  web/             → Next.js 16 (shell, routing, Server Actions)
packages/
  canvas/          → motor react-konva agnóstico (grilla, snap, zoom, pan)
  pieces/          → tipos + validador de piezas personalizadas
  state/           → stores Zustand (scenario, ui, pieces)
  db/              → Prisma schema + client + migrations
  assets/          → catálogo seed + parser de packs
```

## Comandos

```bash
pnpm install          # instalar dependencias
pnpm dev              # levantar todo (turbo)
pnpm --filter web dev # solo la app web
pnpm build            # build de producción
pnpm typecheck        # chequeo de tipos
pnpm lint             # lint
pnpm clean            # limpiar node_modules y caches
```

## Alcance MVP

- Editor de mapa con grilla configurable
- Creación de piezas personalizadas (footprint NxM, imagen, categoría, tags)
- Snap-to-grid, zoom, pan
- Drag de piezas desde un panel lateral
- Persistencia de escenarios (Postgres / Neon)
- Set inicial de tiles Pathfinder
- Sistema de packs importables (`.zip` con JSON + imágenes)

Las fichas de PJ/enemigos son **físicas** (se colocan sobre la pantalla),
no están en el MVP.

## Estado del proyecto

**Fase 0 — Scaffolding** (en curso).
