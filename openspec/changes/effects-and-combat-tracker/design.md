# Effects and Combat Tracker — Design

## 1. Title and status

- **Change:** `effects-and-combat-tracker`
- **Phase:** Design.
- **Status:** Architecture document. The proposal (`proposal.md`) and behavioural
  specification (`spec.md`) are locked; this document does not re-litigate
  their decisions. It defines **how** the locked behaviour is realised in the
  existing Pathfinder codebase.
- **Scope discipline:** Every structural decision below traces back to either
  the proposal's "Locked decisions" section, the spec's Requirements, or an
  existing architecture doc (`docs/architecture/*`). Where a code path diverges
  from one of those, the divergence is called out explicitly with a "FRAGILE"
  or "NOTE" comment in the section header.

## 2. Scope reference

- Proposal: [`proposal.md`](./proposal.md).
- Behavioural specification: [`spec.md`](./spec.md).
- This design binds proposal + spec to the five-file entity split, the
  `applyOpsInTx` replay switch, the `FloorCanvas` render order, and the
  `chromeVisible` invariant on the `RoundViewer`. Any change to the locked
  semantics requires a new proposal.

## 3. Architecture overview

The change sits on top of the existing Pathfinder Server Action → Use Case →
Repository → Prisma stack (`AGENTS.md` §6, `docs/architecture/folder-architecture.md`).
It does **not** introduce a parallel pipeline: the new ops piggy-back on
`ScenarioOpSchema` and the `scenario.repository#applyOpsInTx` transaction so
the autosave path, the undo/redo rebase, and the cache-tag invalidation all
work without modification.

- **Feature A — Persistent AoE markers.** Three new Prisma rows per marker
  (`ScenarioEffect`) plus a flat Zod discriminated union for the wire shape.
  Persistence flows through the same `saveScenarioOps` Server Action; reads
  join the existing `LoadScenarioResult` so the editor hydrates in one round
  trip.
- **Feature B — Combat tracker.** Two new Prisma rows (`Combat`, `Combatant`)
  plus two flat discriminated unions (combat + combatant). Reads join
  `LoadScenarioResult.combat`. Writes flow through the same op pipeline, so
  the cross-feature `nextTurn → tickRound` invariant (combat wrap decrements
  every effect on the scenario) is enforced by **co-locating both arms inside
  the same `applyOpsInTx` TX**. There is no separate scheduler and no
  client-driven timing.

A `Trait registry` analogue is **not** used: the new entities follow the
five-file entity split (`docs/architecture/entity-file-pattern.md`) — one
schema module, one type module, one repository, one use case, one action per
entity, with no registry intermediary.

```
                         ┌─────────────────────────────┐
   Server Action ─────► │   saveScenarioOps           │
   (existing)           │   (existing wrapper)        │
                         └──────────────┬──────────────┘
                                        │ updateTag + revalidatePath
                         ┌──────────────▼──────────────┐
                         │ scenarioUseCases.applyOps   │
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │ scenarioRepository          │
                         │ .applyOpsInTx  (extended)   │ ◄── new switch arms:
                         │   runInTx(db)               │     addEffect, removeEffect,
                         └──────────────┬──────────────┘     tickRound, relabelEffect,
                                        │                    dismissEffect, startCombat,
                                        │                    endCombat, nextTurn, previousTurn,
                                        │                    advanceRound, addCombatant,
                                        ▼                    removeCombatant
                         ┌─────────────────────────────┐
                         │ Prisma (tx, inside runInTx) │
                         │   ScenarioEffect            │ ◄── new table (PR 1)
                         │   Combat + Combatant        │ ◄── new tables (PR 3)
                         └─────────────────────────────┘
```

Caveat: the diagram above is conceptual. Implementation reuses the existing
`Scenario` and `Floor` repositories for transaction composition; only the
new entities get dedicated repository modules.

## 4. Prisma layer

### 4.1 Migration file naming

Follow `prisma.config.ts#migrations.path = 'prisma/migrations'`. Use Prisma's
default naming:

```
prisma/migrations/20250115120000_add_scenario_effects/migration.sql
prisma/migrations/20250116120000_add_combat_and_combatants/migration.sql
```

The timestamp prefix is the local-clock migration create date; the slug is
lower-snake-case describing the change. The Prisma 7 `prisma migrate dev`
workflow is unchanged — `pnpm db:migrate:local` is the only command needed.

### 4.2 Model `ScenarioEffect` (PR 1)

| Field            | Type      | Null | Default | Notes |
|------------------|-----------|------|---------|-------|
| `id`             | `String`  | no   | `cuid()` | PK; client- and server-generable. |
| `scenarioId`     | `String`  | no   | —       | FK → `Scenario.id`. |
| `floorId`        | `String`  | no   | —       | FK → `Floor.id`. Effects are floor-scoped (spec E6, A14). |
| `label`          | `String`  | no   | —       | GM-supplied. No catalog lookup. |
| `kind`           | `String`  | no   | —       | `'burst' \| 'cone' \| 'line' \| 'wall'` (locked, proposal §5.1). Stored as `String`; the discriminated union is enforced by Zod on the wire (spec A7). |
| `originX`        | `Int`     | no   | —       | Active-subdivision grid X of the anchor. |
| `originY`        | `Int`     | no   | —       | Active-subdivision grid Y of the anchor. |
| `widthM`         | `Int`     | no   | —       | Shape width in PF1e feet. Proposal locks "flat, no nested JSON". |
| `depthM`         | `Int`     | no   | —       | Shape depth in PF1e feet. |
| `rotationDeg`    | `Int`     | no   | `0`     | Cone / line orientation; ignored by `burst` / `wall`. |
| `color`          | `String`  | no   | —       | Hex (`#RRGGBB`). Defaulted from palette at the client, overridable via `<input type="color">` (spec A6). |
| `durationKind`   | `String`  | no   | —       | `'rounds' \| 'rounds-concentration' \| 'minutes' \| 'concentration'`. |
| `remainingRounds`| `Int`     | no   | —       | Decremented by `tickRound` inside `applyOpsInTx`. Clamped at 0 (spec A4). |
| `expired`        | `Boolean` | no   | `false` | Flipped to `true` when `remainingRounds` reaches 0; **not** auto-deleted (spec A4, A11). |
| `casterLevelHint`| `Int?`    | yes  | `null`  | Advisory only (proposal §12). v1 modal does not surface it; schema-only for forward-compat. |
| `createdAt`      | `DateTime`| no   | `now()` | |
| `updatedAt`      | `DateTime`| no   | `updatedAt` | Standard Prisma update timestamp (added for parity with `Combat`). |

Indices:

- `@@index([scenarioId])` — fast scenario-wide reads (`findByScenario`) and the
  `updateMany` used by `tickRound` (proposal §9.3, spec A14).
- `@@index([floorId])` — fast per-floor reads (`findByFloor`).

Cascade rules:

- `scenarioId` → `Scenario.id` with `onDelete: Cascade`. Deleting a scenario
  purges all effects on it (proposal §4 "non-goals: no historical archive",
  spec C4).
- `floorId` → `Floor.id` with `onDelete: Cascade`. Deleting a floor purges
  all effects on it (spec A8, C4). This is the hard-coded "clear floor"
  cascade; the application layer never needs to issue a `tx.scenarioEffect.deleteMany`.

**`ScenarioEffect` does not introduce nested JSON columns.** Per the
proposal's lock, `kind` is a `String` and `widthM` / `depthM` are explicit
`Int` columns. There is no `geometry Json` column. Render-side geometry is
computed client-side via `computeEffectFootprint(effect)` (see §13).

**No `lastTickedAtRound` field is added.** Spec B4 ("Previous wraps without
time reversal") and proposal §6.4 lock the asymmetric `previousTurn`
semantics: rewind from index 0 snaps to `combatantCount - 1` **without**
changing `currentRound` and **without** un-ticking effects. The data model
needed is exactly what is in this table — `remainingRounds` is decremented
inside `tickRound` only, and `previousTurn` never invokes `tickRound`. A
`lastTickedAtRound` would not change the behaviour; it was offered and
rejected.

### 4.3 Model `Combat` (PR 3)

| Field              | Type      | Null | Default | Notes |
|--------------------|-----------|------|---------|-------|
| `id`               | `String`  | no   | `cuid()` | PK. |
| `scenarioId`       | `String`  | no   | —       | FK → `Scenario.id`. |
| `currentRound`     | `Int`     | no   | `1`     | Set on `startCombat`; incremented by `nextTurn` wrap and by `advanceRound`. |
| `currentTurnIndex` | `Int`     | no   | `0`     | Pointer into the sorted combatants list. |
| `createdAt`        | `DateTime`| no   | `now()` | |
| `updatedAt`        | `DateTime`| no   | `updatedAt` | |

Constraints:

- `scenarioId @unique` — enforces "1 combat per scenario" at the database
  level (proposal §5.1, spec B1). `startCombat` is idempotent: a second
  invocation against an existing combat throws `P2002` which the use case
  translates to a safe domain error.

Cascade rules:

- `scenarioId` → `Scenario.id` with `onDelete: Cascade`. End-of-scenario
  purges the combat row and (via the cascading FK on `Combatant`) every
  combatant row (spec B2, C4).

### 4.4 Model `Combatant` (PR 3)

| Field        | Type      | Null | Default | Notes |
|--------------|-----------|------|---------|-------|
| `id`         | `String`  | no   | `cuid()` | PK. |
| `combatId`   | `String`  | no   | —       | FK → `Combat.id`. |
| `label`      | `String`  | no   | —       | GM-supplied. |
| `initiative` | `Int`     | no   | —       | Primary sort key, descending. |
| `sortOrder`  | `Int`     | no   | `0`     | Monotonic per-combat tie-breaker (spec B7). Assigned on insert by the `addCombatant` arm. |
| `side`       | `Int`     | no   | —       | `0 = PC`, `1 = monster`, `2 = NPC ally` (proposal §5.1). |
| `createdAt`  | `DateTime`| no   | `now()` | Tie-breaker for equal `initiative` + equal `sortOrder` (spec B7). |

Indices:

- `@@index([combatId, initiative])` — fast ordered scans.
- `@@index([combatId, sortOrder])` — fast ordered scans (alternate index
  used by the rebase arm in `addCombatant`).

Cascade rules:

- `combatId` → `Combat.id` with `onDelete: Cascade`. End-of-combat purges
  every combatant row (proposal §6.4, spec B2). The cascade is the
  explicit "no archive, no log" decision — application code never issues a
  `tx.combatant.deleteMany`.

### 4.5 Unchanged models

`Scenario`, `Floor`, `PaintedCell` are **not** touched. The proposal's
non-goal "no token-bound conditions" is preserved by not extending
`PaintedCell.entityState`.

## 5. Repository layer

### 5.1 New files

| Path | Purpose |
|------|---------|
| `lib/server/db/repository/effect.repository.ts` | `effectRepository(db)` factory for `ScenarioEffect` reads and writes inside a TX. |
| `lib/server/db/repository/combat.repository.ts` | `combatRepository(db)` factory for `Combat` / `Combatant` reads and writes inside a TX. |

Both follow `docs/architecture/repository-pattern.md`:

- Factory function takes `db: PrismaClient | Prisma.TransactionClient` and
  returns the entity-specific operations.
- All write methods accept `tx: Prisma.TransactionClient` as the first arg
  so callers compose them inside the `applyOpsInTx` TX (this is critical
  for the `tickRound → effect updateMany` ordering — see §5.4).
- Read methods in the cache path are **not** exported on the repository
  module's read shape; they live inside the use case so the singleton can be
  imported lazily (see §6).

### 5.2 `effectRepository(db)` shape

```text
findByScenario(scenarioId): Promise<ScenarioEffect[]>      // plain `db` (read)
findByFloor(floorId): Promise<ScenarioEffect[]>            // plain `db` (read)
upsertInTx(tx, scenarioId, input): Promise<ScenarioEffect>  // tx-only
deleteInTx(tx, effectId, scenarioId): Promise<void>         // tx-only
dismissInTx(tx, effectId, scenarioId): Promise<void>        // tx-only; same as delete, kept for symmetry with the op
relabelInTx(tx, effectId, label): Promise<void>             // tx-only
tickRoundInTx(tx, scenarioId): Promise<{ decremented: number; expired: number }>
                                                                // tx-only; single updateMany + flip
```

### 5.3 `combatRepository(db)` shape

```text
findByScenario(scenarioId): Promise<CombatWithCombatants | null>   // plain `db` (read)
findCombatants(combatId): Promise<Combatant[]>                     // plain `db` (read)
startInTx(tx, scenarioId): Promise<Combat>                         // tx-only
endInTx(tx, scenarioId): Promise<void>                             // tx-only; cascade via Prisma
nextTurnInTx(tx, scenarioId): Promise<{ combat, wrapped }>          // tx-only; returns wrapped=true on wrap
previousTurnInTx(tx, scenarioId): Promise<Combat>                  // tx-only; never wraps `tickRound`
advanceRoundInTx(tx, scenarioId): Promise<Combat>                  // tx-only; rebases pointer + ticks
addCombatantInTx(tx, scenarioId, input): Promise<{ combat, sortOrder, indexDelta }>
                                                                       // tx-only; returns the rebase delta
removeCombatantInTx(tx, scenarioId, combatantId): Promise<{ combat, indexDelta }>
                                                                       // tx-only; returns the rebase delta
```

### 5.4 Extension to `scenarioRepository.applyOp`

The switch in `lib/server/db/repository/scenario.repository.ts` is extended
with one arm per new op. The arms **delegate to the entity repositories**
above rather than touching Prisma directly; this keeps the per-entity
Prisma code in one place.

Per-arm replay logic:

| Op arm           | Replay logic (inside the open `tx`) |
|------------------|--------------------------------------|
| `addEffect`      | `effectRepository(tx).upsertInTx(tx, scenarioId, op.effect)`. Validates `op.effect.floorId` belongs to the scenario by reading `tx.floor.findUnique` first; throws `safe error` if not. |
| `removeEffect`   | `effectRepository(tx).deleteInTx(tx, op.effectId, scenarioId)`. No-op if the row is already gone (idempotent — `tx.scenarioEffect.deleteMany` returns `{count: 0}`). |
| `tickRound`      | `effectRepository(tx).tickRoundInTx(tx, scenarioId)`. Single `updateMany` with `{ remainingRounds: { decrement: 1 } }` filtered to `remainingRounds > 0`, then a second `updateMany` to flip `expired = true` where `remainingRounds = 0`. **Both updateManys are inside the same `tx`** — proposal §9.3 "the `applyOp` switch is the single point of truth for `tickRound` invocation". |
| `relabelEffect`  | `effectRepository(tx).relabelInTx(tx, op.effectId, op.label)`. |
| `dismissEffect`  | `effectRepository(tx).dismissInTx(tx, op.effectId, scenarioId)`. Same as `removeEffect` semantically; kept separate so analytics / UI can distinguish the GM intent (spec A11). |
| `startCombat`    | `combatRepository(tx).startInTx(tx, scenarioId)`. `scenarioId @unique` enforces idempotence; throws `safe error: 'Ya hay un combate activo'` on `P2002`. |
| `endCombat`      | `combatRepository(tx).endInTx(tx, scenarioId)`. The cascade deletes every `Combatant` row in the same TX. Guarded by `COMBAT_FINALISATION_ENABLED` (proposal §10.5). |
| `nextTurn`       | `combatRepository(tx).nextTurnInTx(tx, scenarioId)` returns `{ combat, wrapped }`. **If `wrapped`, the same arm immediately calls `effectRepository(tx).tickRoundInTx(tx, scenarioId)`** — all inside the same `tx`. The order is: first mutate `Combat` (`currentTurnIndex = 0`, `currentRound += 1`), then run the effect `updateMany`. |
| `previousTurn`   | `combatRepository(tx).previousTurnInTx(tx, scenarioId)`. From index 0, snap to `combatantCount - 1`; **do not touch `currentRound`**, **do not call `tickRoundInTx`** (spec B4, lock — see §4.2 "no `lastTickedAtRound`"). |
| `advanceRound`   | `combatRepository(tx).advanceRoundInTx(tx, scenarioId)` updates `currentRound += 1`, `currentTurnIndex = 0`, then calls `effectRepository(tx).tickRoundInTx(tx, scenarioId)` — both inside the same `tx`. |
| `addCombatant`   | `combatRepository(tx).addCombatantInTx(tx, scenarioId, op.combatant)` returns `{ combat, sortOrder, indexDelta }`; the arm writes `combat.currentTurnIndex += indexDelta` (clamped at `[0, combatants.length - 1]`) inside the same `tx`. No `tickRound`. |
| `removeCombatant`| `combatRepository(tx).removeCombatantInTx(tx, scenarioId, op.combatantId)` returns `{ combat, indexDelta }`; the arm writes the rebased pointer inside the same `tx`. No `tickRound`. |

**Cross-arm ordering rule.** Whenever an op arm combines a `Combat` mutation
with an effect `tickRound` (the `nextTurn` wrap path and `advanceRound`),
the `Combat` row is mutated first (pointer / round) and `tickRoundInTx` runs
second. Rationale: if the TX rolls back (e.g. Prisma `P2025` on the effect
updateMany), the combat pointer must roll back with it — never half-advance
the round. This is also why the `tickRoundInTx` repository method is **not
exported as a standalone use case** (proposal §9.3): the only legal caller
is `applyOp`, and a code comment at the top of `tickRoundInTx` makes that
contract explicit.

**`currentTurnIndex` rebase arithmetic.** The rebase lives in the use case
layer (which has access to the freshly-loaded `combatants` array) — see §6
for the invariants. The repository returns the index delta, not the final
value, so the use case owns the clamping.

**Exhaustiveness.** The existing `default: { const _exhaustive: never = op; ... }`
arm at the bottom of `applyOp` is unchanged: adding a new variant is a
compile-time error until the switch grows an arm.

### 5.5 Singleton import discipline

The new repositories accept `db` / `tx` as a parameter — they never import
the Prisma singleton. The singleton is consumed only inside the **read**
paths of the use case layer (`§6`), and only lazily inside the function
body per `docs/architecture/use-case-pattern.md`.

## 6. Use-case layer

### 6.1 `effectUseCases`

File: `lib/server/useCases/effect.usecases.ts`.

```text
listByScenario(scenarioId): Promise<ScenarioEffect[]>     // cached read, lazy singleton
listByFloor(floorId): Promise<ScenarioEffect[]>          // cached read, lazy singleton
```

Read methods:

- Open with `'use cache'`, `cacheLife('hours')`, then
  `cacheTag('pathfinder:scenarios', \`pathfinder:scenario:${id}\`)`. The
  list-and-scenario-tag strategy means `updateTag('pathfinder:scenario:${id}')`
  from the action invalidates the read on write.
- Lazy-import the singleton inside the function body:
  `const db = (await import('@/lib/server/db/db')).default;`
- Pass `db` into `effectRepository(db).findByScenario(...)`.

Writes (op-based, no use case methods) flow through `applyOp` in
`scenario.repository.ts`. There is no `effectUseCases.save` — the proposal
§5.5 explicitly says writes are op-based only.

### 6.2 `combatUseCases`

File: `lib/server/useCases/combat.usecases.ts`.

```text
findByScenario(scenarioId): Promise<CombatView | null>    // cached read, lazy singleton
                                                               // returns { combat, combatants }
                                                               // joined in one Prisma query
```

Read method:

- Same `'use cache'`, `cacheLife('hours')`,
  `cacheTag('pathfinder:scenarios', \`pathfinder:scenario:${id}\`)` triple.
- Lazy singleton import.
- Delegates to `combatRepository(db).findByScenario(scenarioId)` which does
  the joined Prisma query.

Writes are op-based only (no `combatUseCases.start` / `end` / `nextTurn`).
This is intentional: the `nextTurn → tickRound` invariant requires both arms
to share one TX, which only happens inside `applyOp`.

### 6.3 `scenarioUseCases.findByIdWithEffectsAndCombat`

Per proposal §5.3, the existing `scenarioUseCases.findById` is **extended**
(not replaced). The new shape:

```text
findById({ id }: { id: string }): Promise<LoadScenarioResult | null>
```

The `LoadScenarioResult` payload grows two new fields:

```ts
effects: ScenarioEffect[];
combat: CombatView | null; // null until startCombat
```

The cache directive triple is unchanged:
`cacheTag('pathfinder:scenarios', \`pathfinder:scenario:${id}\`)`. Because
the new fields are read inside the same function body as the original
scenario load, they share the same cache key and the same `updateTag` from
`saveScenarioOps` invalidates both. This is the single-source-of-truth
mitigation called out in proposal §9.4.

The repository call composes in one Prisma transaction:

```ts
return runInTx(db)(async (tx) => ({
  ...baseScenario,
  effects: await effectRepository(tx).findByScenario(id),
  combat: await combatRepository(tx).findByScenario(id),
}));
```

**NOTE**: the existing `findByIdWithFloors` method on `scenarioRepository`
stays untouched for backwards compatibility with anything that imports it
directly. Only the use case surface changes.

## 7. Server Actions

### 7.1 Action envelope

All actions use the canonical `ActionResult<T>` from
`docs/architecture/error-handling.md`. Handlers return the domain value or
throw a safe error; the `createAction` wrapper builds the envelope.

### 7.2 `lib/server/actions/effect.action.ts`

```text
readEffects({ scenarioId }): Promise<ActionResult<ScenarioEffect[]>>
```

Read-back action used by the editor mount (proposal §5.5). Wraps
`effectUseCases.listByScenario`. Cached (`'use cache'` propagates from the
use case); no `updateTag` on read paths.

There is **no write action** in `effect.action.ts` because all writes are
op-based and flow through `saveScenarioOps`. This matches the proposal
§5.2 contract: "no new action is created for the GM mutation entrypoint".

### 7.3 `lib/server/actions/combat.action.ts`

```text
readCombat({ scenarioId }): Promise<ActionResult<CombatView | null>>
```

Read-back action, wraps `combatUseCases.findByScenario`.

Again, **no write action** — combat writes go through the op pipeline.

### 7.4 Cache invalidation rules in `saveScenarioOps`

The existing `saveScenarioOps` action (`lib/server/actions/scenario.action.ts`)
is **the only place** that writes effects or combat state. Its existing
post-save block already does the right thing for the new fields:

```ts
const result = await scenarioUseCases.applyOps(db, data);
updateTag('pathfinder:scenarios');
updateTag(`pathfinder:scenario:${result.id}`);
revalidatePath('/');
return result;
```

Because the cached `findByIdWithEffectsAndCombat` read in §6.3 is tagged
with `pathfinder:scenario:${id}`, the existing `updateTag` line above
invalidates the entire read on write — there is no new writer to wire up.
This is exactly the "single cached read" mitigation in proposal §9.4.

### 7.5 `revalidatePath` rules

`saveScenarioOps` already calls `revalidatePath('/')`. The home page lists
scenario summaries via `scenarioUseCases.list()` (`cacheTag('pathfinder:scenarios')`),
so the `updateTag('pathfinder:scenarios')` covers it; `revalidatePath('/')`
remains as the conservative belt-and-braces call per
`docs/architecture/cache-tag-convention.md` §"Which one to call".

The `revalidatePath('/editor')` call is **not** added because the editor
itself is `dynamic = 'force-dynamic'` and reads via `loadScenario`
(uncached for editor renders). The cached read path is the summary list on
`/`, which is already covered.

## 8. Zod schemas

Both schemas follow the existing flat-discriminated-union pattern in
`lib/shared/schemas/piece.schemas.ts` and the existing op pattern in
`lib/shared/schemas/scenarioOp.schemas.ts`: Zod-only at the schema layer,
DTOs inferred in the type layer, **no nested JSON objects**, **no Prisma
imports**. See `docs/architecture/entity-file-pattern.md` §"Rules".

### 8.1 `lib/shared/schemas/effect.schemas.ts`

```ts
export const EffectKindSchema = z.enum(['burst', 'cone', 'line', 'wall']);

export const DurationKindSchema = z.enum([
  'rounds',
  'rounds-concentration',
  'minutes',
  'concentration',
]);

// PF1e feet / grid units. Integer-only; non-positive is rejected.
const POSITIVE_INT = z.number().int().positive();
const NON_NEGATIVE_INT = z.number().int().nonnegative();
const GRID_INT = z.number().int(); // signed

// Hex colour matcher used by both the schema and the modal preview swatch.
const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color debe ser #RRGGBB');

export const ScenarioEffectSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  floorId: z.string().min(1),
  label: z.string().min(1).max(120),
  kind: EffectKindSchema,
  originX: GRID_INT,
  originY: GRID_INT,
  widthM: POSITIVE_INT,
  depthM: POSITIVE_INT,
  rotationDeg: NON_NEGATIVE_INT.max(359),
  color: HEX_COLOR,
  durationKind: DurationKindSchema,
  remainingRounds: NON_NEGATIVE_INT,
  expired: z.boolean(),
  casterLevelHint: z.number().int().positive().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ScenarioEffectInsertSchema = ScenarioEffectSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export const AddEffectOpSchema = z.object({
  type: z.literal('addEffect'),
  effect: ScenarioEffectInsertSchema,
});
export const RemoveEffectOpSchema = z.object({
  type: z.literal('removeEffect'),
  effectId: z.string().min(1),
});
export const TickRoundOpSchema = z.object({ type: z.literal('tickRound') });
export const RelabelEffectOpSchema = z.object({
  type: z.literal('relabelEffect'),
  effectId: z.string().min(1),
  label: z.string().min(1).max(120),
});
export const DismissEffectOpSchema = z.object({
  type: z.literal('dismissEffect'),
  effectId: z.string().min(1),
});
```

**Discriminator hygiene.** Every effect op variant uses `type: z.literal(...)`
so the existing `z.discriminatedUnion('type', [...])` machinery in
`scenarioOp.schemas.ts` narrows correctly. The `kind` and `durationKind`
fields are themselves `z.enum` discriminators — the union pattern
(`z.discriminatedUnion('kind', ...)`) is not needed for v1 because every
op variant carries the same shape (`widthM` / `depthM` / `originX` / etc.)
and the per-shape differences are geometry-only (handled client-side in
§13). If PR 4+ introduces per-kind fields (e.g. cone `angleDeg`), the schema
can be promoted to a discriminated union at that time.

### 8.2 `lib/shared/schemas/combat.schemas.ts`

```ts
export const SideSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
// 0 = PC, 1 = monster, 2 = NPC ally (proposal §5.1).

export const CombatantSchema = z.object({
  id: z.string().min(1),
  combatId: z.string().min(1),
  label: z.string().min(1).max(80),
  initiative: z.number().int(),
  sortOrder: z.number().int().nonnegative(),
  side: SideSchema,
  createdAt: z.date(),
});
export const CombatantInsertSchema = CombatantSchema.omit({
  combatId: true,
  sortOrder: true,
  createdAt: true,
});

export const CombatSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  currentRound: z.number().int().positive(),
  currentTurnIndex: z.number().int().nonnegative(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CombatViewSchema = z.object({
  combat: CombatSchema,
  combatants: z.array(CombatantSchema),
});

export const StartCombatOpSchema = z.object({ type: z.literal('startCombat') });
export const EndCombatOpSchema = z.object({ type: z.literal('endCombat') });
export const NextTurnOpSchema = z.object({ type: z.literal('nextTurn') });
export const PreviousTurnOpSchema = z.object({ type: z.literal('previousTurn') });
export const AdvanceRoundOpSchema = z.object({ type: z.literal('advanceRound') });
export const AddCombatantOpSchema = z.object({
  type: z.literal('addCombatant'),
  combatant: CombatantInsertSchema,
});
export const RemoveCombatantOpSchema = z.object({
  type: z.literal('removeCombatant'),
  combatantId: z.string().min(1),
});
```

### 8.3 `ScenarioOpSchema` extension

The new op schemas are appended to the existing
`z.discriminatedUnion('type', [...])` array in
`lib/shared/schemas/scenarioOp.schemas.ts`. The caller model is unchanged:

```ts
export const ScenarioOpSchema = z.discriminatedUnion('type', [
  // ... existing variants ...
  AddEffectOpSchema,
  RemoveEffectOpSchema,
  TickRoundOpSchema,
  RelabelEffectOpSchema,
  DismissEffectOpSchema,
  StartCombatOpSchema,
  EndCombatOpSchema,
  NextTurnOpSchema,
  PreviousTurnOpSchema,
  AdvanceRoundOpSchema,
  AddCombatantOpSchema,
  RemoveCombatantOpSchema,
]);
```

The `ScenarioSaveRequestSchema` is unchanged — it already accepts an array
of `ScenarioOpSchema` items. **There is no parallel schema module** for the
new ops; they ride on the same discriminated union so the existing
`saveScenarioOps` action and the existing `useOpsBuffer` keep working
unchanged at the wire shape.

### 8.4 Constants for limits

`120` (effect label), `80` (combatant label) and the kind / durationKind
literals are imported from `lib/shared/constants/effects.ts` and
`lib/shared/constants/combat.ts` respectively (§10). The schemas never
inline magic numbers.

## 9. Types layer

### 9.1 `lib/shared/types/effect.types.ts`

```ts
export type EffectKind = z.infer<typeof EffectKindSchema>;       // 'burst' | 'cone' | 'line' | 'wall'
export type DurationKind = z.infer<typeof DurationKindSchema>;   // 'rounds' | 'rounds-concentration' | ...
export type ScenarioEffect = z.infer<typeof ScenarioEffectSchema>;
export type ScenarioEffectInsert = z.infer<typeof ScenarioEffectInsertSchema>;
export type ScenarioEffectOfKind<K extends EffectKind> = ScenarioEffect & { kind: K };
```

The DTOs are inferred from the schemas; no `import type` from
`@prisma/client`. `ScenarioEffectOfKind` is a discriminated narrow for
callers that want to branch on `kind` without re-asserting the literal.

### 9.2 `lib/shared/types/combat.types.ts`

```ts
export type Side = z.infer<typeof SideSchema>;                    // 0 | 1 | 2
export type Combat = z.infer<typeof CombatSchema>;
export type Combatant = z.infer<typeof CombatantSchema>;
export type CombatantInsert = z.infer<typeof CombatantInsertSchema>;
export type CombatView = z.infer<typeof CombatViewSchema>;        // { combat, combatants }
```

### 9.3 `LoadScenarioResult` extension

```ts
// lib/shared/types/scenario.types.ts
export type LoadScenarioResult = {
  id: string;
  name: string;
  baseCellSize: number;
  width: number;
  height: number;
  floors: Floor[];
  activeFloorId: string;
  paintedCells: PaintedCell[];
  effects: ScenarioEffect[];      // ← NEW (PR 1, default [])
  combat: CombatView | null;      // ← NEW (PR 3, default null)
};
```

The two new fields default to `[]` / `null` on legacy scenarios that were
saved before the migration — the existing `findByIdWithFloors` already
returns `null` for the active floor fallback, so the same defensive
pattern applies to `combat`. The `findByIdWithEffectsAndCombat` use case
adds the new fields unconditionally; legacy scenarios get empty arrays
because `effect.findByScenario` and `combat.findByScenario` return `[]`
and `null` respectively.

### 9.4 Re-export from the `lib/shared/types/index.ts` barrel

The new type modules are added to the existing barrel so consumers don't
need a second import path. This matches the convention in
`docs/architecture/folder-architecture.md`.

## 10. Runtime constants

### 10.1 `lib/shared/constants/effect-palette.ts` (NEW, PR 1)

```ts
import type { EffectKind } from '@/lib/shared/types/effect.types';

export type EffectPaletteEntry = {
  kind: EffectKind;
  defaultColorHex: `#${string}`;
  dashedStroke: boolean;       // true for cones and walls, false for bursts
  label: string;               // Spanish, used by the modal radio labels
  defaultWidthM: number;       // per-shape default footprint width (PF1e feet)
  defaultDepthM: number;       // per-shape default footprint depth
};

export const EFFECT_PALETTE: Record<EffectKind, EffectPaletteEntry> = {
  burst:  { kind: 'burst',  defaultColorHex: '#ff6b35', dashedStroke: false, label: 'Burst',  defaultWidthM: 20, defaultDepthM: 20 },
  cone:   { kind: 'cone',   defaultColorHex: '#ffd166', dashedStroke: false, label: 'Cono',   defaultWidthM: 15, defaultDepthM: 15 },
  line:   { kind: 'line',   defaultColorHex: '#118ab2', dashedStroke: false, label: 'Línea',  defaultWidthM: 5,  defaultDepthM: 60 },
  wall:   { kind: 'wall',   defaultColorHex: '#9b5de5', dashedStroke: true,  label: 'Muro',   defaultWidthM: 5,  defaultDepthM: 30 },
};

// Operational flags (proposal §10.5 "disable paths without reverting").
export const ENABLE_EFFECTS_LAYER = true;
export const TICK_ROUND_ENABLED = true;
export const COMBAT_FINALISATION_ENABLED = true;
```

The colour regex is shared with the Zod schema (see §8.1) via the
template-literal type — `defaultColorHex` is typed as `` `#${string}` `` so
the runtime check (`/^#[0-9a-fA-F]{6}$/`) catches typos at the source.

### 10.2 `lib/shared/constants/combat.ts` (NEW, PR 3)

```ts
import type { Side } from '@/lib/shared/types/combat.types';

export const SIDE_LABEL: Record<Side, string> = {
  0: 'PC',
  1: 'Monstruo',
  2: 'Aliado NPC',
};

export const COMBATANT_LABEL_MAX = 80;
export const EFFECT_LABEL_MAX = 120;
```

### 10.3 `lib/shared/constants/index.ts`

The barrel gains two `export * from` lines:

```ts
export * from './effect-palette';
export * from './combat';
```

### 10.4 `lib/shared/utils/generateId.ts` extension

`IdKind` gains `'effect' | 'combat' | 'combatant'`:

```ts
export type IdKind = 'cell' | 'floor' | 'scenario' | 'effect' | 'combat' | 'combatant';
```

`newId(kind)` continues to call `generateId(prefix)` so the wire format
stays uniform. The prefix literals are the source of truth for the
`scenarioEffect_<rand>` / `combat_<rand>` / `combatant_<rand>` strings the
editor and the schema see.

## 11. Editor UI architecture

### 11.1 New files

| Path (TARGET) | Purpose |
|---------------|---------|
| `app/editor/components/EffectsModal/EffectsModal.tsx` | List-and-editor modal for `ScenarioEffect`s on the active floor. |
| `app/editor/components/EffectsModal/EffectsModal.module.css` | List-and-editor layout, consistent with `components/shortcuts-modal.module.css`. |
| `app/editor/hooks/use-effects-modal.ts` | Modal state machine (`isOpen`, `selectedId`, `isCreating`), exposes the `pushAddEffect` / `pushRelabelEffect` / `pushDismissEffect` helpers wired through `useOpsBuffer`. |
| `app/editor/components/CombatModal/CombatModal.tsx` | "Nuevo combate" / "Editar combate" form (label + initiative + side for each combatant in a row, plus a bulk-add textarea). |
| `app/editor/components/CombatModal/CombatModal.module.css` | Same layout convention as `EffectsModal`. |
| `app/editor/hooks/use-combat-session.ts` | The read-side hook exposed by spec B9; wraps the loaded `combat` + `currentCombatant` + `sortedCombatants` derivation. |
| `src/canvas/components/RoundViewer.tsx` | The persistent bottom-centre viewer. **Renders outside `FloatingPanel` — see §11.5.** |
| `src/canvas/components/RoundViewer.module.css` | Bottom-centre fixed positioning. |
| `src/canvas/hooks/useEffectMarkers.ts` | Memoised marker geometry + visibility per effect (see §13). |
| `src/canvas/effects/footprint.ts` | `computeEffectFootprint(effect)` — geometry helper, server-safe. |
| `src/canvas/tools/effectGeometry.ts` | Wall-aware reachability wrapping `eraseFootprintFor` with the per-floor `isWall` predicate (proposal §5.9). **No new BFS code.** |

### 11.2 Where the modal buttons live

In `EditorClient.tsx`, `secondaryActions` (the existing div at the bottom
of the floating aside) gains one new `<Button>` between "Clima" and
"Limpiar":

```
Atajos  Clima  Efectos  Limpiar
                    ↑
                new (PR 2)
```

The button uses `faHatWizard` (FontAwesome) and opens `EffectsModal` via
the `useEffectsModal` hook. The `Shift+E` shortcut binds to the same
open / close handler.

For combat, the trigger is the existing header's combat-indicator chip
(see §11.4); the first time it is clicked with `combat === null` it opens
`CombatModal` in "create" mode, otherwise in "edit" mode.

### 11.3 `useCombatSession` contract

`useCombatSession({ scenarioId }: { scenarioId: string })` returns:

```ts
{
  combat: Combat | null;            // null until startCombat
  combatants: Combatant[];          // empty array until first addCombatant
  sortedCombatants: Combatant[];    // by initiative DESC, sortOrder ASC, createdAt ASC
  currentCombatant: Combatant | null;
  isOpen: boolean;                  // combat !== null
  start: () => void;                // pushStartCombat → save
  end: () => void;                  // opens confirm dialog
  nextTurn: () => void;
  previousTurn: () => void;
  advanceRound: () => void;
  addCombatant: (input) => void;
  removeCombatant: (id: string) => void;
}
```

The hook does **not** call Server Actions directly. It pushes to the
existing `useOpsBuffer` (extended in PR 3 with `pushStartCombat` etc.),
and the existing `useScenarioAutosave` drains the buffer. This is the same
pattern the existing paint / erase ops use.

### 11.4 `RoundViewer` placement

`RoundViewer` is rendered **as a direct sibling of `<FloorStack>` inside
the `editor` `<div>`**, not inside either `<FloatingPanel>`:

```tsx
<div className={styles.editor} data-chrome-visible={chromeVisible}>
  <FloatingPanel as="aside" ...>  {/* chromeVisible-aware */}
  <FloatingPanel as="header" ...> {/* chromeVisible-aware */}
  <div className={styles.canvasStage}>
    <FloorStack ... />
  </div>
  <RoundViewer ... />             {/* ← NEW, chromeVisible-agnostic */}
  <ShortcutsModal ... />
  <EffectsModal ... />
  <CombatModal ... />
</div>
```

Because `FloatingPanel` applies `inert={!chromeVisible}` to its subtree
(`components/FloatingPanel.tsx`), any DOM placed **outside** a `FloatingPanel`
ignores the toggle. `RoundViewer`'s outer wrapper carries
`position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%);`
in `RoundViewer.module.css` so it stays anchored when the chrome hides.

This is the lock from proposal §6.5 / spec B8.

### 11.5 Combat indicator in `floatingHeader`

The existing `<header>` `FloatingPanel` gains one chip to the **right** of
the autosave status:

```tsx
<span className={styles.autosaveStatus} ...>...</span>
<Button variant="primary" onClick={() => save(false)} ...>Guardar</Button>
<span className={styles.combatIndicator}>         {/* ← NEW */}
  Ronda {combat.currentRound} · {currentCombatant?.label ?? '—'}
</span>
```

The chip is `chromeVisible`-aware (it lives inside the header `FloatingPanel`),
but the `RoundViewer` (outside) is the persistent surface — the chip is a
mirror of the same state. Both display the same round + combatant, computed
from the same `useCombatSession` hook (spec B9).

## 12. FloorCanvas render order

### 12.1 Pseudocode

The new effects `<Konva.Layer>` is inserted **before** the
`cellsBySub.map(...)` block. Inside the existing JSX the order is:

```tsx
<Stage {...stageProps}>
  <EffectsLayer
    effects={effects}                  // ← NEW (lowest z)
    walls={walls}                      // ← NEW: Set<string> of "x|y" cells
    baseCellSize={mapDims.baseCellSize}
    subdivisions={subdivisions}
    activeSubdivisionId={activeSubdivisionId}
    onClickEffect={openEffectsModal}   // ← opens modal in edit mode
  />
  {cellsBySub.map(({ sub, cells: subCells }) => {
    const cellSize = cellSizeFor(sub);
    if (sub.id === 'obscured') {
      // Darkness overlay — stays above the effects layer.
      return <Layer key={sub.id} listening={false}>{...}</Layer>;
    }
    // Other subdivisions (estructuras, etc.) — stay above the effects layer.
    return <Layer key={sub.id} listening={false}>{...}</Layer>;
  })}
  {showBrushPreview && (
    <Layer listening={false}>           {/* brush preview — topmost */}
      {previewCells.map(...)}
    </Layer>
  )}
</Stage>
```

The order is locked:

1. **Effects `<Layer>` — bottommost.** Renders `Rect` filled with the
   effect colour at 0.4 alpha per visible cell, computed by
   `useEffectMarkers` (§13). `listening={true}` when an effect is being
   created / edited (so the click handler fires), otherwise `listening={false}`
   so the markers never intercept paint / erase hit tests on the cells
   underneath (proposal §5.8).
2. **`cellsBySub` — middle.** Each subdivision gets its own layer in
   `sub.order` ascending order. The `obscured` subdivision (darkness) is
   one of these layers — because the existing `useSubdivisionMap` orders
   them by `order` and `obscured` has the highest `order`, darkness paints
   on top of the markers without any new layering code. This is the lock
   from proposal §6.1 / spec A1.
3. **Brush preview `<Layer>` — topmost.** Unchanged from today.

The `useFloorCanvas` props are extended with `effects: ScenarioEffect[]` and
`walls: Set<string>`. The `floorCanvasPropsAreEqual` comparator
(`src/canvas/components/floor-canvas/comparators.ts`) grows one new check:

```ts
(prev: Readonly<Props>, next: Readonly<Props>): boolean => {
  // ... existing checks ...
  return (
    // ... existing comparisons ...
    prev.effects === next.effects &&    // ← NEW (parent memoises by reference)
    prev.walls === next.walls           // ← NEW (parent memoises by reference)
  );
};
```

`effects` and `walls` come from the parent (`FloorStack`) which is
`React.memo`'d. The parent re-buckets when the `LoadScenarioResult.effects`
reference changes (which happens only after a successful autosave); the
inactive-floor memo comparator sees the same `effects` reference for every
stroke, so the inactive floor stays skipped.

### 12.2 `useEffectMarkers` contract

```ts
type EffectMarker = {
  effect: ScenarioEffect;
  visibleCells: BrushCell[];
  renderKind: 'normal' | 'expired' | 'blocked';
};

useEffectMarkers(
  effects: ScenarioEffect[],
  walls: Set<string>,                        // "x|y" keys of estructura cells
  baseCellSize: number,                      // for the bounds clip
  subdivisions: readonly SubdivisionConfig[], // for bounds + activeSubdivision
): EffectMarker[];
```

The hook:

1. Filters `effects` to the active `floorId` (caller may pre-filter; the
   hook is defensive and re-filters by the active `floorId` derived from
   `subdivisions`).
2. For each effect, computes the **geometric footprint** by calling
   `computeEffectFootprint(effect)` (see §13). This is the rectangle /
   cone / line / wall cell list before wall-aware filtering.
3. Runs `eraseFootprintFor(centre, geometricFootprint, isWall)` where
   `isWall(x, y) => walls.has(`${x}|${y}`)` and `centre` is the effect's
   `originX/Y`. **This reuses the existing `src/canvas/tools/eraseFootprint.ts`
   module verbatim** — no new BFS code (proposal §6.2, spec A2, lock).
4. Returns the filtered cells. `renderKind` is:
   - `'normal'` when the effect is not expired and has visible cells,
   - `'expired'` when `effect.expired === true` (renders at reduced
     opacity + clock-strikethrough icon, spec A4),
   - `'blocked'` when the visible set is empty (anchor-overpainted
     vignette, spec A13).

Memoisation key (the hook uses `useMemo`):

```text
[effects, walls, baseCellSize, subdivisions]
```

`effects` and `walls` come from the parent as referentially-stable values;
the inner loop is `O(effects × maxFootprintCells)`, comfortably under 1 ms
for the realistic case (≤ 10 effects × ≤ 400 cells each).

### 12.3 Konva key uniqueness

Each `Rect` inside the effects layer uses `key={\`effect-${effect.id}-${cell.gridX}-${cell.gridY}\`}`
to ensure uniqueness even when two effects share an anchor + kind. The
tooltip popup uses `key={\`effect-tooltip-${effect.id}\`}` for the same
reason (proposal §9.7 "Effect id collisions in the render layer").

## 13. Wall-aware BFS reuse

The existing `src/canvas/tools/eraseFootprint.ts` exports one pure function:

```ts
export function eraseFootprintFor(
  centre: BrushCell,
  footprint: readonly BrushCell[],
  isWall: (x: number, y: number) => boolean,
): BrushCell[];
```

This module is **the only BFS implementation** used by effect rendering.
The new layer adds two thin wrappers:

### 13.1 `src/canvas/effects/footprint.ts` — `computeEffectFootprint`

Pure function, no React, no Konva:

```ts
export function computeEffectFootprint(effect: ScenarioEffect): BrushCell[] {
  switch (effect.kind) {
    case 'burst': return burstFootprint(effect);    // rectangle centred on (originX, originY)
    case 'cone':  return coneFootprint(effect);     // 90° fan from origin up to depthM
    case 'line':  return lineFootprint(effect);     // Bresenham 8-connected to (originX+depthM, ...)
    case 'wall':  return wallFootprint(effect);     // oriented rectangle, widthM × depthM
  }
}
```

Per-kind helpers live in the same file (or split per-kind if file grows).
Each is a small, server-safe geometric function. **No BFS** — these are
straightforward integer-grid projections.

### 13.2 `src/canvas/tools/effectGeometry.ts` — wall-aware wrapper

```ts
import { eraseFootprintFor } from './eraseFootprint';
import { computeEffectFootprint } from '@/src/canvas/effects/footprint';

export function effectVisibleCells(
  effect: ScenarioEffect,
  walls: Set<string>,
): BrushCell[] {
  const centre: BrushCell = { gridX: effect.originX, gridY: effect.originY };
  const geometricFootprint = computeEffectFootprint(effect);
  return eraseFootprintFor(centre, geometricFootprint, (x, y) => walls.has(`${x}|${y}`));
}
```

`walls` is the set of `estructuras` cells on the **same floor** as the
effect. The parent (`FloorStack`) builds this once per render:

```ts
const walls = useMemo(() => {
  const set = new Set<string>();
  for (const c of cells) {
    if (c.subdivisionId === 'estructuras') set.add(`${c.gridX}|${c.gridY}`);
  }
  return set;
}, [cells]);
```

**No new BFS code path.** The Bresenham implementation in
`eraseFootprint.ts` is reused as-is. This is the lock from proposal §6.2 /
spec A2.

## 14. Keyboard shortcut registry

### 14.1 `ShortcutCategory` extension

`lib/shared/constants/shortcuts.ts`:

```ts
export type ShortcutCategory =
  | 'tool'
  | 'brush'
  | 'save'
  | 'navigation'
  | 'overlay'
  | 'edit'
  | 'combat';   // ← NEW
```

### 14.2 New entries in `SHORTCUTS`

| Key        | ID                  | label                                    |
|------------|---------------------|------------------------------------------|
| `Shift+E`  | `toggleEffectsModal` | Abrir / cerrar modal de efectos        |
| `C`        | `toggleCombat`      | Iniciar / finalizar combate              |
| `N`        | `nextTurn`          | Siguiente combatiente (con tick al wrap) |
| `J`        | `previousTurn`      | Combatiente anterior (sin tick)          |
| `R`        | `advanceRound`      | Avanzar ronda manualmente                |
| `K`        | `addCombatant`      | Añadir combatiente durante el combate    |

Each entry uses the matching `KEYS_BY_CODE.keyX` literal so the existing
`bindShortcut('id', handler)` keeps working. The `toggleCombat` entry has
no `shift`; the modal-guard contract below decides whether it opens the
confirm dialog or is inert.

### 14.3 `bindShortcut` and `buildEditorShortcuts`

`bindShortcut` is unchanged. The existing
`bindShortcut` (and `ShortcutId` union) auto-extends via the new
`SHORTCUTS` entries. `buildEditorShortcuts` (in `app/editor/shortcuts.ts`)
gains six new lines:

```ts
bindShortcut('toggleEffectsModal', () => {
  if (modalOpenRef.current) return;
  args.toggleEffectsModal();
}),
bindShortcut('toggleCombat', () => {
  if (modalOpenRef.current) return;
  args.toggleCombat();   // delegate: confirms end, starts if none
}),
bindShortcut('nextTurn', () => {
  if (modalOpenRef.current) return;
  args.opsBuffer.pushNextTurn();
  args.markDirty();
}),
bindShortcut('previousTurn', () => {
  if (modalOpenRef.current) return;
  args.opsBuffer.pushPreviousTurn();
  args.markDirty();
}),
bindShortcut('advanceRound', () => {
  if (modalOpenRef.current) return;
  args.opsBuffer.pushAdvanceRound();
  args.markDirty();
}),
bindShortcut('addCombatant', () => {
  if (modalOpenRef.current) return;
  args.openAddCombatant();    // opens CombatModal in add mode
}),
```

`args` grows the new functions in `Args`:

```ts
type Args = {
  // ... existing args ...
  toggleEffectsModal: () => void;
  toggleCombat: () => void;
  openAddCombatant: () => void;
  modalOpenRef: { current: boolean };        // ← NEW
};
```

### 14.4 Modal-guard contract

Every new shortcut handler closes over `modalOpenRef` whose `.current` is a
boolean that is `true` while **any** of the following is open:

- `EffectsModal`
- `CombatModal` (in either create or edit mode)
- `ShortcutsModal`
- `TraitMenu` (the existing right-click menu — already opens on cell right-click)

The ref is owned by `EditorClient` and mutated by each modal's
`onOpen` / `onClose` callbacks. The ref-backed value (not React state) is
intentional: the shortcut handler closure stays stable across re-renders,
so `useKeyboardShortcuts` does not re-attach its `keydown` listener on every
state change (matching the existing `shortcutsRef` pattern in
`useKeyboardShortcuts`).

The contract is enforced by:

1. The handler closure starts with `if (modalOpenRef.current) return;` — a
   single line that any reviewer can grep.
2. `buildEditorShortcuts` documents the rule in its JSDoc, with a
   `// FRAGILE` comment near the six new lines so a future contributor
   cannot forget the guard.

The `closeOverlay` handler (existing) continues to also close any modal
that happens to be open. The six new handlers' guards are additive: even
if `closeOverlay` fires first, the `modalOpenRef.current` is updated by the
modal's `onClose` callback before the next handler runs.

## 15. Cache invalidation

### 15.1 Single-source-of-truth rule

There is **one** mutation entrypoint: `saveScenarioOps` in
`lib/server/actions/scenario.action.ts`. Its existing post-save block is
the only place that calls `updateTag`:

```ts
const result = await scenarioUseCases.applyOps(db, data);
updateTag('pathfinder:scenarios');
updateTag(`pathfinder:scenario:${result.id}`);
revalidatePath('/');
return result;
```

Because the cached `findByIdWithEffectsAndCombat` use case in §6.3 is
tagged with `pathfinder:scenario:${id}`, this single `updateTag` line
invalidates the entire editor read after any effect / combat mutation.
There are no new Server Actions that mutate effects or combat state — all
writes flow through `saveScenarioOps`. There is therefore no cache-tag
drift risk from new write paths.

The read-back actions `readEffects` and `readCombat` (§7.2, §7.3) do
**not** call `updateTag` because they are read-only; the cached use cases
they wrap carry the tags and the invalidation happens in `saveScenarioOps`.

### 15.2 `revalidatePath` policy

- `revalidatePath('/')` is called from `saveScenarioOps` and stays
  unchanged.
- `revalidatePath('/editor')` is **not** added. The editor is dynamically
  rendered and reads via `loadScenario` (uncached for editor mounts); the
  cached path is the home summary list, already covered.

### 15.3 No `revalidateTag` in any action

`revalidateTag` is forbidden in Server Actions by
`docs/architecture/cache-tag-convention.md` and the change does not
introduce any.

## 16. Risks and mitigations

### 16.1 PR 2 density (modal + walls + overlap + shortcut)

`EffectsModal` is the largest single component in the change (~250 lines
per proposal §8.2). The wall-aware BFS for cones is non-trivial. Mitigation:

- The render-side hooks (`computeEffectFootprint`, `effectVisibleCells`,
  `useEffectMarkers`) are split into per-file modules so each can be
  reviewed in isolation.
- The modal accessibility surface (focus trap, scroll lock, screen-reader
  announcements) reuses the existing `components/Modal.tsx` primitive.
- The alpha-blend cap (spec A3, `0.7` maximum) lands in PR 4 if PR 2
  exceeds the 600-line budget. The un-capped blend is acceptable for v1.

### 16.2 Cache-tag drift

The wrapper `createAction` cannot enforce the `updateTag('pathfinder:scenarios')
+ updateTag(\`pathfinder:scenario:${id}\`)` pair. The mitigation is
structural: **there is exactly one mutation action** (`saveScenarioOps`),
so the `updateTag` lines cannot be forgotten. The new
`readEffects` / `readCombat` read-back actions are read-only and need no
`updateTag`.

A short note is appended to `AGENTS.md` §6 (or §12 migration debt) when
PR 1 lands, stating:

> New effect / combat writes MUST flow through `saveScenarioOps`. Adding a
> new writer that bypasses the op pipeline requires a new
> `cacheTag` entry and a code-review note in the PR description.

### 16.3 `nextTurn → tickRound` cross-TX ordering

The `nextTurn` op arm mutates `Combat.currentTurnIndex` / `currentRound`
first, then calls `effectRepository(tx).tickRoundInTx(tx, scenarioId)`.
Both happen inside the same `runInTx(db)` opened by `applyOpsInTx`. The
explicit ordering rule (combat first, effects second) is documented as
an inline comment at the top of the `nextTurn` arm in
`scenario.repository.ts`. If the TX rolls back (e.g. Prisma `P2025` on
the effect updateMany), the combat pointer rolls back with it — the GM
never sees a half-advanced round.

`tickRoundInTx` is intentionally **not exported** as a standalone use
case method, so the only legal caller is `applyOp` (proposal §9.3). A
code comment at the top of the method makes this contract explicit.

### 16.4 Effect id collisions on the canvas

When two effects share an anchor + kind on the same floor, their Konva
Rect `key` props must be unique. The render layer uses
`effect-${effect.id}-${cell.gridX}-${cell.gridY}` (see §12.3) so collision
is structurally impossible. Tooltip aggregation uses `effect.id` as the
deduplication key.

### 16.5 Geometry under-inclusion for cones and lines

`eraseFootprintFor` is Bresenham 8-connected, which may over- or
under-shoot the "true" cone by one cell along the diagonal (proposal §9.5).
PR 2 ships a slightly **wider** cone (over-inclusive) rather than a narrower
one: under-inclusive would silently hide cells the GM needs to see. PR 4
refines if playtesting surfaces the over-inclusion.

### 16.6 `addCombatant` / `removeCombatant` rebase arithmetic

The rebase arithmetic is sensitive to ties (equal initiative + equal
`sortOrder` → fall back to `createdAt`). The repository's
`addCombatantInTx` returns the `indexDelta` (number of positions the new
combatant was inserted before) so the use case can clamp
`currentTurnIndex + indexDelta` to the valid range `[0, combatants.length - 1]`
in one place. The `sortOrder` is derived as `currentMax + 1` in the same
TX to keep monotonicity stable (spec B7).

### 16.7 PF1e stack-rule is non-binding without a catalog

The modal warns on duplicate labels but does not block (spec E1, A10). A
PR 4 polish note in `EffectsModal` reads "Esta regla es no-vinculante sin
catálogo de hechizos". The `color` field gives the GM a manual override
per marker; this is the same affordance users already have for terrain.

## 17. Decision log

Locked decisions restated from `proposal.md` and `spec.md`, with the
design's responsibility for each:

| # | Decision (locked)                                                                 | Where the design honours it |
|---|-------------------------------------------------------------------------------------|-----------------------------|
| 1 | Effects `Konva.Layer` before `cellsBySub.map(...)`; `obscured` stays above it.     | §12.1 (Stage JSX) + §12.2 (useEffectMarkers). |
| 2 | Reuse `eraseFootprintFor` from `src/canvas/tools/eraseFootprint.ts`; no new BFS.    | §13.2 (effectGeometry wraps it). |
| 3 | One `Combat` per scenario (`scenarioId @unique`).                                   | §4.3 (Prisma `@unique`) + §5.4 `startCombat` idempotence. |
| 4 | `endCombat` cascades `Combatant` via Prisma `onDelete: Cascade`.                    | §4.4 (Prisma cascade) + §5.4 `endInTx` is a single `delete`. |
| 5 | `RoundViewer` is rendered outside any `FloatingPanel`.                             | §11.4 (sibling of `<FloorStack>`). |
| 6 | New keyboard shortcuts under `ShortcutCategory: 'combat'`.                         | §14.1 / §14.2. |
| 7 | Modal-guard contract: every new shortcut is inert while any modal is open.          | §14.4 (`if (modalOpenRef.current) return;`). |
| 8 | No token-bound conditions. `PaintedCell.entityState` is not extended.              | §4.5 (no PaintedCell change). |
| 9 | No hard-coded spell catalog. Modal is the catalog.                                 | §11.1 (EffectsModal is the only entrypoint). |
| 10 | Asymmetric `previousTurn`: wrap without `tickRound`, without un-tick.              | §4.2 (no `lastTickedAtRound`) + §5.4 (previousTurn arm never calls tickRoundInTx). |
| 11 | Concentration visual via `durationKind === 'rounds-concentration'`; dashed border. | §10.1 (`dashedStroke` palette entry) + §13.1 (renderKind hint in useEffectMarkers). |
| 12 | Colour picker overrides palette; same `color` column.                              | §4.2 (single `color String`) + §10.1 (default + override). |
| 13 | No tests; `pnpm typecheck | lint | check` only.                                  | Out of scope; PR descriptions carry this rule. |
| 14 | Write flow goes through `saveScenarioOps` only.                                    | §5.4 (applyOp arms) + §7 (no write actions). |
| 15 | `updateTag('pathfinder:scenario:${id}')` invalidates both base + new fields.        | §6.3 (single cached read) + §15.1 (single updateTag pair). |
| 16 | Persistence inside the existing `applyOpsInTx` TX; `nextTurn → tickRound` is atomic. | §5.4 (single TX, explicit ordering rule). |

## 18. Open assumptions

None. The proposal, the spec, and the product-question round have already
locked every product question. The only assumptions made by this design
are technical / structural:

- The existing `scenarioUseCases.findById` cached read is the right place
  to extend for the editor hydration (proposal §5.3). No product choice.
- `React.memo` is the right comparator extension for `effects` and `walls`
  in `floorCanvasPropsAreEqual`. No product choice.
- `useRef`-backed modal-open state is the right pattern for the shortcut
  handlers, matching the existing `shortcutsRef` in
  `useKeyboardShortcuts`. No product choice.

No new product question is raised.
