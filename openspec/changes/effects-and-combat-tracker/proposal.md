# Effects and Combat Tracker — Proposal

## 1. Title and status

- **Change:** `effects-and-combat-tracker`
- **Status:** Proposal (parent-driven; product questions already answered; this document is locked-in intent, not a re-negotiation).
- **Artifact store:** `openspec` (in-repo, versioned under `openspec/changes/effects-and-combat-tracker/`).
- **Delivery strategy:** `force-chained` — four reviewable PRs at ≤ 600 changed lines each.
- **Strict TDD:** `false`. The repo has no test runner; `AGENTS.md` §3 and `openspec/config.yaml#testing` prohibit claiming test coverage. PRs are validated with `pnpm typecheck | lint | check`.

## 2. Intent

Pathfinder is a single Next.js 16 battle-map editor for a Pathfinder 1e game master. Today the GM can paint terrain, open/close/lock doors, and toggle darkness, but there is no way to mark a spell whose effect spans multiple combat rounds, and there is no combat tracker. As a result, the GM mentally tracks initiative order on paper and re-paints the same fireball template every time a round advances. This breaks the core loop of PF1e combat: the round/turn cycle that drives the game's clock.

This change introduces two interlocking features:

- **Feature A — Persistent AoE markers.** A `ScenarioEffect` Prisma model that stores a labelled area-of-effect (burst / cone / line / wall) tied to a specific floor of a specific scenario. The marker is created once, persists across reloads, ticks down on round advance, and is deleted by the GM when the spell ends.
- **Feature B — Combat tracker.** A `Combat` Prisma model (1:1 with `Scenario`) and a `Combatant` Prisma model. A persistent `RoundViewer` shows the current round and the current combatant; advancing the round also ticks all in-scenario effects.

For whom: the GM running a PF1e campaign on a single laptop during in-person play. The work assumes a single user, no auth, no multi-tenancy, no realtime sync — consistent with `AGENTS.md` §11.

## 3. Goals

Measurable outcomes the change must deliver:

1. The GM can create a labelled AoE marker (burst/cone/line/wall) on any floor, with shape, dimensions, colour and a duration in rounds; the marker persists via the existing op-based autosave and re-renders after a full page reload of `/editor?id=…`.
2. The GM can advance the round manually; every effect on the active scenario has its `remainingRounds` decremented by 1 inside the same `applyOps` transaction; effects whose `remainingRounds` reaches `0` are marked `expired` and rendered with reduced opacity + a clock-strikethrough icon until the GM dismisses them from the modal.
3. The GM can start combat, add combatants with initiative + name + side, advance/rewind the turn pointer, see the current round and current combatant in a persistent bottom-centre viewer that ignores the `chromeVisible` toggle, and end combat (which cascades the `Combat` and `Combatant[]` rows).
4. All new persistence flows through the existing `ScenarioOpSchema → useOpsBuffer → saveScenarioOps → scenarioRepository.applyOpsInTx → Prisma` pipeline. New Prisma models follow the five-file entity split documented in `docs/architecture/entity-file-pattern.md` (no new file patterns introduced).
5. Render-side: the new effects `Konva.Layer` is inserted before `cellsBySub.map(...)` in `src/canvas/components/FloorCanvas.tsx` so the existing `obscured` subdivision (darkness) continues to stack above markers. Geometric cells covered by an effect are precomputed with wall-aware Bresenham BFS, reusing `eraseFootprintFor` from `src/canvas/tools/eraseFootprint.ts` (no new BFS code path).
6. All new keyboard shortcuts are added to `lib/shared/constants/shortcuts.ts` under a new `ShortcutCategory: 'combat'`.

## 4. Non-goals

Explicitly out of scope for this change (would be a new proposal if revisited):

- **No token-bound conditions / status effects.** Per-piece debuffs, conditions, and HP tracking on painted cells are not in scope. A `PaintedCell` does not gain a `status` field.
- **No hard-coded spell catalog.** The modal is the catalog. Spell templates (e.g. "Burning Hands", "Fireball") were considered and rejected for the first slice.
- **No historical combat archive.** Ending combat purges the `Combat` and `Combatant[]` rows via Prisma `onDelete: Cascade`. There is no log, no replay, no PDF export.
- **No realtime / multi-user sync.** No Soketi, no pusher, no polling. `AGENTS.md` §11 confirms this is out of scope app-wide.
- **No test runner / no claimed coverage.** Validation is `pnpm typecheck | lint | check`. `AGENTS.md` §3 and `openspec/config.yaml#testing.forbidden_test_commands` forbid `pnpm test`.
- **No per-floor combat.** A scenario has exactly one `Combat` row; combatants may originate on any floor but appear in one initiative-ordered list.
- **No automatic stack-rule enforcement.** Distinct AoE spells coexist; identical-label spells warn but do not block. The PF1e "identical spells do not stack, take the stronger" rule is non-binding without a catalog.
- **No auth, no multi-tenancy, no payment, no file upload.** Consistent with `AGENTS.md` §11.
- **No migration of pre-existing scenarios beyond a no-op `addEffect` on first save.** Existing scenarios without effects stay empty.

## 5. Affected areas

Files, modules, Prisma models, and Server Actions touched. Paths are absolute under the repository root.

### 5.1 Prisma schema (`prisma/schema.prisma`)

- **New model `ScenarioEffect`** — one row per AoE marker. Fields:
  - `id String @id @default(cuid())`
  - `scenarioId String` — FK to `Scenario`, `onDelete: Cascade`
  - `floorId String` — FK to `Floor`, `onDelete: Cascade` (effect is per-floor)
  - `label String` — GM-defined; no catalog lookup
  - `kind String` — `'burst' | 'cone' | 'line' | 'wall'` (stored as string; the discriminated union is encoded in Zod on the wire and validated in the editor)
  - `originX Int`, `originY Int` — anchor cell in active-subdivision coords
  - `widthM Int`, `depthM Int` — shape dimensions in PF1e feet (or whatever unit the editor later settles on; treated as opaque ints for v1)
  - `rotationDeg Int @default(0)` — for cone/line orientation; ignored by burst/wall
  - `color String` — hex string; default = palette colour for `kind`, override set by the colour picker in the modal
  - `durationKind String` — `'rounds' | 'rounds-concentration' | 'minutes' | 'concentration'`
  - `remainingRounds Int` — decremented by `tickRound` inside `applyOpsInTx`
  - `expired Boolean @default(false)` — flipped to `true` when `remainingRounds` reaches `0`; the row is only deleted by an explicit `removeEffect` or `dismissEffect` op
  - `createdAt DateTime @default(now())`
  - Indexes: `@@index([scenarioId])`, `@@index([floorId])`.
- **New model `Combat`** — 1:1 with `Scenario`:
  - `id String @id @default(cuid())`
  - `scenarioId String @unique` — FK to `Scenario`, `onDelete: Cascade`
  - `currentRound Int @default(1)`
  - `currentTurnIndex Int @default(0)` — index into the sorted `Combatant[]`
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
- **New model `Combatant`** — N:1 with `Combat`:
  - `id String @id @default(cuid())`
  - `combatId String` — FK to `Combat`, `onDelete: Cascade`
  - `label String`
  - `initiative Int` — primary sort key, descending
  - `sortOrder Int @default(0)` — tie-breaker for equal initiative
  - `side Int` — `0 = player-character`, `1 = monster`, `2 = NPC ally` (covers summons)
  - `createdAt DateTime @default(now())`
  - Indexes: `@@index([combatId, initiative])`, `@@index([combatId, sortOrder])`.
- **No changes to `Scenario`, `Floor`, `PaintedCell`.**

### 5.2 Server actions (`lib/server/actions/`)

- `lib/server/actions/scenario.action.ts` — `saveScenarioOps` is reused as-is (the new op variants are added to the schema; the action itself does not change). No new action is created for the GM mutation entrypoint — it is the same `saveScenarioOps` call the editor already makes.
- `lib/server/actions/scenario.action.ts` (PR 4 only) — `endCombat` is exposed as a thin action that calls `scenarioUseCases.endCombat(db, { scenarioId })`. The action is the only place that calls `revalidatePath('/editor')`; the op-based path inside `applyOps` does not (write goes through the existing tag update).

### 5.3 Use cases (`lib/server/useCases/`)

- `lib/server/useCases/scenario.usecases.ts` — add a single read method `findByIdWithEffectsAndCombat({ id })` that extends the existing `LoadScenarioResult` with `effects: ScenarioEffect[]` and `combat: { id, currentRound, currentTurnIndex, combatants: Combatant[] } | null`. Wraps the repository call; marks `'use cache'`, `cacheLife('hours')`, `cacheTag('pathfinder:scenarios', 'pathfinder:scenario:${id}')` so `updateTag('pathfinder:scenario:${id}')` invalidates the read on write.

### 5.4 Repository (`lib/server/db/repository/scenario.repository.ts`)

- `applyOp(tx, scenarioId, op)` — add five new switch arms for the new op variants (see §5.6).
- After the `for (const op of request.ops)` loop in `applyOpsInTx`, when the batch contains a `tickRound` op or a `nextTurn` op that wraps the turn index, the same transaction must also `tx.scenarioEffect.updateMany` for every effect on the scenario whose `remainingRounds > 0` (or `> 1` depending on the op), inside the same `runInTx`. This is the only place `tickRound` runs — there is no parallel write path.

### 5.5 New entity files (PR 1 + PR 3)

Following `docs/architecture/entity-file-pattern.md`:

- `lib/shared/schemas/scenarioEffect.schemas.ts` — Zod schemas for the entity and the op variants.
- `lib/shared/types/scenarioEffect.types.ts` — `z.infer` types, including `ScenarioEffect`, `ScenarioEffectOfKind`.
- `lib/server/db/repository/scenarioEffect.repository.ts` — Prisma factory.
- `lib/server/useCases/scenarioEffect.usecases.ts` — read methods only (writes are op-based; see §5.6).
- `lib/server/actions/scenarioEffect.action.ts` — only used for the read-back triggered when the editor mounts (writes do not flow through this action; they go through `saveScenarioOps`).
- Plus `combat.schemas.ts` / `combat.types.ts` / `combat.repository.ts` / `combat.usecases.ts` / `combat.action.ts` for `Combat` + `Combatant`.

### 5.6 Op variants (extend `lib/shared/schemas/scenarioOp.schemas.ts`)

Five new variants added to the `ScenarioOpSchema` discriminated union. The existing `applyOp` switch in `scenario.repository.ts` gains one arm per variant:

- `addEffect` — `{ type: 'addEffect', effect: ScenarioEffectInsert }`. Inserts via `tx.scenarioEffect.create`.
- `removeEffect` — `{ type: 'removeEffect', effectId: string }`. Hard delete.
- `tickRound` — `{ type: 'tickRound' }`. No params; scans the whole scenario, decrements `remainingRounds` and flips `expired = true` where appropriate. Idempotent only within one tick (each `tickRound` op decrements by exactly 1).
- `relabelEffect` — `{ type: 'relabelEffect', effectId: string, label: string }`.
- `dismissEffect` — `{ type: 'dismissEffect', effectId: string }`. Same as `removeEffect` semantically (the user can re-create from the modal), kept separate so the editor can surface a "Dismiss" vs "Dispel Magic" distinction in the UI and analytics if needed later.
- `startCombat` — `{ type: 'startCombat' }`. Creates a `Combat` row with `currentRound = 1, currentTurnIndex = 0`.
- `endCombat` — `{ type: 'endCombat' }`. `tx.combat.delete({ where: { scenarioId } })` — cascades `Combatant[]` via `onDelete: Cascade`.
- `nextTurn` — `{ type: 'nextTurn' }`. Reads combatants sorted by `initiative DESC, sortOrder ASC, createdAt ASC`; if `currentTurnIndex + 1 < combatants.length`, increments; otherwise sets `currentTurnIndex = 0` AND `currentRound += 1` AND enqueues a `tickRound` of all effects in the same TX.
- `previousTurn` — `{ type: 'previousTurn' }`. Mirror of `nextTurn`; if `currentTurnIndex === 0`, wraps to last and decrements `currentRound` (floor at 1) without ticking effects (turning back time does not undo duration decrements).
- `advanceRound` — `{ type: 'advanceRound' }`. `currentRound += 1`, `currentTurnIndex = 0`, ticks effects. Bound to `R` for manual "end of round" if the GM is not using per-turn advancement.
- `addCombatant` — `{ type: 'addCombatant', combatant: CombatantInsert }`. Inserts the combatant, recomputes the initiative-ordered list, and re-bases `currentTurnIndex` so the same combatant is highlighted as before the insert. No `tickRound`.
- `removeCombatant` — `{ type: 'removeCombatant', combatantId: string }`. Hard delete; re-bases `currentTurnIndex`.

### 5.7 Client buffer (`app/editor/hooks/use-ops-buffer.ts`)

- Adds `pushAddEffect`, `pushRemoveEffect`, `pushTickRound`, `pushRelabelEffect`, `pushDismissEffect`, `pushStartCombat`, `pushEndCombat`, `pushNextTurn`, `pushPreviousTurn`, `pushAdvanceRound`, `pushAddCombatant`, `pushRemoveCombatant`. All use the same `syncPush` plumbing. No coalescing on `tickRound` (each call is a discrete user action).

### 5.8 Render (`src/canvas/components/FloorCanvas.tsx`)

- New `Konva.Layer` is inserted **before** the `cellsBySub.map(...)` block. This is the locked render order (see §6.1). The layer is `listening={true}` only when an effect is currently being created/edited; otherwise `listening={false}` so markers never block paint/erase hit tests on the cells underneath.
- The new `FloorCanvas` prop is `effects: ScenarioEffect[]`. The parent (`FloorStack` / `EditorClient`) is responsible for filtering by `floorId` — the canvas does not re-filter.
- Wall-aware BFS is performed once per effect per render (memoised by `(effect.id, effect.kind, effect.originX, effect.originY, effect.widthM, effect.depthM, effect.rotationDeg, paintedCells-of-estructuras)`) using `eraseFootprintFor` with `isWall = (x, y) => paintedCells.some(c => c.subdivisionId === 'estructuras' && c.gridX === x && c.gridY === y)`. The `paintedCells` array is already passed in via the existing `cells` prop; the canvas memo comparator (`floorCanvasPropsAreEqual`) is updated to compare the `effects` reference.

### 5.9 New files

- `src/canvas/components/EffectsLayer.tsx` (PR 2) — the per-floor effects layer, including wall-aware BFS and overlap blending.
- `src/canvas/components/EffectsModal.tsx` (PR 2) — the list+editor modal; sibling to `ShortcutsModal`.
- `src/canvas/components/CombatModal.tsx` (PR 3) — the "Nuevo combate" form.
- `src/canvas/components/RoundViewer.tsx` (PR 3) — the persistent bottom-centre viewer. **Rendered outside `FloatingPanel` in `EditorClient.tsx`** so `chromeVisible` does not hide it.
- `src/canvas/hooks/useScenarioEffects.ts` (PR 1) — read-side hook that splits the loaded effects by `floorId`, mirroring `useFloorCellsByFloor`.
- `src/canvas/hooks/useCombat.ts` (PR 3) — read-side hook that exposes the current `Combat` and a stable `currentCombatant` derived from the sorted list.
- `src/canvas/tools/effectGeometry.ts` (PR 2) — wraps `eraseFootprintFor` with an `isWall` for the effect-geometry path; reuses the existing module (no new BFS code).
- `lib/shared/constants/effects.ts` (PR 1) — palette colours keyed by `kind`, and the per-shape defaults (`{ defaultWidthM, defaultDepthM, ... }`).
- `lib/shared/utils/generateId.ts` — extended with `IdKind: 'effect' | 'combat' | 'combatant'` and the matching `newId(...)` helpers (per the README guardrail in `openspec/changes/effects-and-combat-tracker/README.md`).
- `lib/shared/constants/shortcuts.ts` — adds `ShortcutCategory: 'combat'` and the seven new entries listed in §6.6.

### 5.10 Editor chrome (`app/editor/EditorClient.tsx`, `app/editor/editor.module.css`)

- `secondaryActions` gets a new `<Button>` "Efectos" opening the `EffectsModal`. Sits next to "Clima", "Limpiar", "Ayuda" per the existing pattern.
- A new combat indicator (current round + current combatant name + side pill) is added to the `floatingHeader`, right of the autosave status.
- `RoundViewer` is rendered as a sibling of `FloorStack`, not nested inside any `FloatingPanel`.

## 6. Locked decisions

The following are **already decided by the user** during the proposal-question round. They are documented here so the spec / design / tasks phases do not re-litigate them.

### 6.1 Render order

A new effects `Konva.Layer` is inserted **before** `cellsBySub.map(...)` in `src/canvas/components/FloorCanvas.tsx`. The existing `obscured` subdivision (darkness) continues to stack above the markers because it is one of the cells-by-subdivision layers with the highest `order`. The brush-preview layer stays at the top as today. This is the only render order that matches the user's stated behaviour (markers visible on top of terrain but hidden by darkness).

### 6.2 BFS reuse

`eraseFootprintFor` from `src/canvas/tools/eraseFootprint.ts` is reused for wall-aware BFS precomputation of visible cells per effect. No new BFS code path. The `isWall` predicate is wired to `paintedCells` with `subdivisionId === 'estructuras'`.

### 6.3 Cross-floor combat is global

A single `Combat` per scenario (the Prisma `scenarioId @unique` constraint enforces it). Combatants may be added from any floor, but they appear in one initiative-ordered list. Floor-scoped combat is explicitly NOT supported.

### 6.4 Combat end purges the row

`tx.combat.delete({ where: { scenarioId } })` cascades to `Combatant[]` via Prisma `onDelete: Cascade`. No archive, no log, no "last combat" row.

### 6.5 Round Viewer ignores `chromeVisible`

`RoundViewer` is rendered as a direct child of the `editor` `<div>`, not inside any `FloatingPanel`. The `inert={!chromeVisible}` toggle therefore does not reach it.

### 6.6 New keyboard shortcuts (all under `ShortcutCategory: 'combat'`)

Added to `lib/shared/constants/shortcuts.ts`:

| Key | ID | Bound in PR | Effect |
|---|---|---|---|
| `Shift+E` | `toggleEffectsModal` | PR 2 | Open/close the Efectos modal |
| `C` | `toggleCombat` | PR 3 | Start/end combat |
| `N` | `nextTurn` | PR 3 | Advance to the next combatant (with `tickRound` on wrap) |
| `J` | `previousTurn` | PR 3 | Step back to the previous combatant (no `tickRound`) |
| `R` | `advanceRound` | PR 3 | Manually advance a round (ticks all effects) |
| `K` | `addCombatant` | PR 3 | Open the "add combatant" form mid-combat |
| `Escape` | (existing) | — | Already closes modals |

### 6.7 No token-bound conditions

Status effects attached to a painted piece are explicitly out of scope. The `PaintedCell.entityState` field is not extended.

### 6.8 No hard-coded spell catalog

The modal is the catalog. Spell templates were considered and rejected for the first slice.

### 6.9 Concentration visual

Effects with `durationKind: 'rounds-concentration'` render with a dashed border overlay. Implemented client-side based on the `durationKind` value; no separate visual schema is needed.

### 6.10 Color picker override

The modal has a colour `<input type="color">` whose default equals the `kind`'s palette colour. Stored as `color: String` in `ScenarioEffect`. The same field is used for both palette and override.

### 6.11 No tests

The repo has no test runner. PRs are validated with `pnpm typecheck | lint | check`. Do not claim test coverage.

## 7. PF1e alignment

The proposal respects the following Pathfinder 1e rules. These are decisions the user has already made; they are documented here so the spec / design / tasks do not treat them as open.

- **Duration by caster level (CL).** Spells with "X rounds/level" count by caster level, not spell level. The modal exposes `remainingRounds` and a "Concentration" flag; it does NOT auto-derive from CL (no character sheet in this app). The GM types the final number from the spell description. The spec phase will add a `casterLevelHint: Int?` field for the GM's bookkeeping; it is purely advisory.
- **End "just before the same initiative count".** The round-counter approximation satisfies ~95 % of this rule. Foundry VTT and Roll20 do the same. The `tickRound` semantics in §5.4 / §5.6 implement the round-counter: every time the initiative list wraps (or `R` is pressed), `remainingRounds -= 1` for every effect on the scenario. The implementation is a single `updateMany` inside the same `applyOpsInTx` TX — no separate scheduler, no setTimeout, no client-driven timing.
- **1 round = full cycle of one turn per combatant ≈ 6 s.** "Next turn" (`N`) does NOT decrement effect durations; "advance round" (`R`) and the wrap-on-last-combatant path inside `nextTurn` DO. This matches the PF1e definition: durations are round-quantised, not turn-quantised.

## 8. PR plan — four force-chained PRs at ≤ 600 changed lines

Each PR is independently reviewable and reverts cleanly without breaking the build. Approximate file-level deliverables and a line budget per PR are listed below. Numbers are estimates; the `< 600` cap is the hard rule.

### 8.1 PR 1 — Persistence + minimal render

**Goal:** effects survive a reload and render as a simple burst. No UI controls yet.

**Files added (~12, ~500 lines):**

- `prisma/schema.prisma` (+50) — `ScenarioEffect` model + indexes.
- `lib/shared/schemas/scenarioEffect.schemas.ts` (+60) — Zod schema + the 5 effect op variants (`addEffect`, `removeEffect`, `tickRound`, `relabelEffect`, `dismissEffect`).
- `lib/shared/types/scenarioEffect.types.ts` (+25) — inferred types + `ScenarioEffectOfKind` discriminant.
- `lib/server/db/repository/scenarioEffect.repository.ts` (+40) — Prisma factory: `findByScenario`, `findByFloor`, `upsertInTx`, `deleteInTx`, `tickRoundInTx` (decrement + flip `expired`).
- `lib/server/useCases/scenarioEffect.usecases.ts` (+30) — read methods with `'use cache'` + `cacheTag('pathfinder:scenarios', 'pathfinder:scenario:${id}')`.
- `lib/server/actions/scenarioEffect.action.ts` (+20) — read-back action used by the editor mount.
- `lib/shared/constants/effects.ts` (+25) — palette colour table keyed by `kind` + per-shape defaults.
- `lib/shared/utils/generateId.ts` (+5) — add `'effect'` to `IdKind`.
- `src/canvas/hooks/useScenarioEffects.ts` (+50) — splits effects by `floorId`, mirrors `useFloorCellsByFloor`.
- `src/canvas/components/EffectsLayer.tsx` (+150) — first cut: a single rectangular burst rendered with `Rect` filled with the palette colour at 0.4 alpha. No walls, no overlap, no modal.
- `app/editor/EditorClient.tsx` (+30) — wire `effects` prop into `FloorStack`; read via `useScenarioEffects`.
- `src/canvas/components/FloorCanvas.tsx` (+15) — insert the `EffectsLayer` before `cellsBySub.map(...)`; pass `effects` prop.

**Estimated total:** ~500 lines. Smoke test: `pnpm db:migrate:local`, `pnpm prisma:generate`, then manually call `saveScenarioOps` from dev tools with an `addEffect` op and verify the row appears, then reload the page and verify the burst renders.

**Review focus:** schema migration safety; `applyOp` switch exhaustiveness; cache-tag invalidation.

### 8.2 PR 2 — Modal + tool + walls + overlap

**Goal:** GM can create / edit / dismiss effects from the editor.

**Files added (~10, ~580 lines):**

- `src/canvas/components/EffectsModal.tsx` (+250) — list+editor layout, consistent with `components/ShortcutsModal.tsx` and `components/Modal.tsx`. Renders effects for the active floor on the left, editor form on the right. Form fields: label, kind (radio), origin (cell-click picker), widthM, depthM, rotationDeg (disabled for burst/wall), color (colour input, default = palette), durationKind (radio: `rounds | rounds-concentration | minutes | concentration`), remainingRounds.
- `src/canvas/components/EffectsModal.module.css` (+120) — list+editor layout, consistent with `shortcuts-modal.module.css`.
- `src/canvas/tools/effectGeometry.ts` (+50) — wraps `eraseFootprintFor` with an `isWall` predicate for the effect path. **No new BFS code.**
- `app/editor/EditorClient.tsx` (+60) — `showEffectsModal` state, `Shift+E` shortcut via `bindShortcut('toggleEffectsModal', ...)`; new `<Button>` in `secondaryActions` opening the modal; pass `openEffectsModal: () => setShowEffectsModal(true)` down through `FloorStack` so a future "click empty cell to start an effect" can pick the origin.
- `lib/shared/schemas/scenarioOp.schemas.ts` (+30) — the 5 effect op variants (already drafted in PR 1 schemas but the `applyOp` arms land here in PR 2 to keep PR 1 strictly persistence).
- `lib/server/db/repository/scenario.repository.ts` (+40) — 5 new `applyOp` switch arms.
- `src/canvas/components/EffectsLayer.tsx` (+80 net) — wall-aware rendering using `effectGeometry`, alpha-blend overlap (cap 0.7), concentration dashed-border overlay, expired effects rendered with reduced opacity + clock-strikethrough icon, marker click tooltip with the label and remaining rounds.
- `app/editor/PaintToolbar.tsx` (+20) — optional "add effect" button next to the existing tools; only enabled if a future "effects tool" is wired (deferred to a follow-up; for v1 the modal is the only entry point and this button is a placeholder that opens the modal).
- `lib/shared/constants/shortcuts.ts` (+25) — `toggleEffectsModal` entry.

**Estimated total:** ~580 lines (tight; the modal is the densest work unit — see §9.1).

**Review focus:** modal accessibility (escape, focus trap, scroll lock), wall-aware BFS correctness for cones and lines, alpha-blend cap.

### 8.3 PR 3 — Combat tracker

**Goal:** GM can run combat; the Round Viewer is always visible.

**Files added (~14, ~550 lines):**

- `prisma/schema.prisma` (+45) — `Combat` + `Combatant` models.
- `lib/shared/schemas/combat.schemas.ts` (+90) — schemas for `Combat`, `Combatant`, the 8 combat op variants (`startCombat`, `endCombat`, `nextTurn`, `previousTurn`, `advanceRound`, `addCombatant`, `removeCombatant`).
- `lib/shared/types/combat.types.ts` (+30) — inferred types + `Side` enum (`0 | 1 | 2`).
- `lib/server/db/repository/combat.repository.ts` (+80) — `findByScenario`, `findCombatants`, `addCombatantInTx`, `removeCombatantInTx`, `nextTurnInTx` (with wrap + `tickRound` of effects), `previousTurnInTx`, `advanceRoundInTx`, `endCombatInTx` (the cascade delete).
- `lib/server/useCases/combat.usecases.ts` (+50) — read methods with `'use cache' + cacheTag('pathfinder:scenarios', 'pathfinder:scenario:${id}')`.
- `lib/server/actions/combat.action.ts` (+20) — read-back action for editor mount.
- `lib/shared/utils/generateId.ts` (+2) — add `'combat'` and `'combatant'` to `IdKind`.
- `app/editor/hooks/use-ops-buffer.ts` (+80) — 8 new `push*` helpers for the combat ops.
- `src/canvas/components/CombatModal.tsx` (+120) — the "Nuevo combate" form (initial combatants batch with label + initiative + side; or empty + add mid-combat).
- `src/canvas/components/CombatModal.module.css` (+40).
- `src/canvas/hooks/useCombat.ts` (+60) — exposes `combat`, `currentCombatant`, `sortedCombatants`. `currentCombatant` is derived from the sorted list and `currentTurnIndex`; memoised.
- `src/canvas/components/RoundViewer.tsx` (+90) — bottom-centre fixed positioning; shows round, current combatant (label + initiative + side pill), Prev/Next/Menu/Advance-round buttons. **Rendered as a direct child of the `editor` div in `EditorClient.tsx`, not inside any `FloatingPanel` — so `chromeVisible` does not hide it.**
- `app/editor/EditorClient.tsx` (+40) — wire `RoundViewer`, add the combat indicator to `floatingHeader`, register the 5 new shortcuts (`C`, `N`, `J`, `R`, `K`) via `bindShortcut`, wire `startCombat` / `endCombat` to a confirm dialog.
- `lib/shared/constants/shortcuts.ts` (+30) — 5 new entries under `ShortcutCategory: 'combat'`.
- `app/editor/editor.module.css` (+30) — `.roundViewer` fixed bottom-centre.

**Estimated total:** ~550 lines. The `nextTurnInTx` "wrap → `tickRound`" branch is the densest piece of business logic in this PR; it must be co-located with the `Combatant` sort key in one place so the order is unambiguous.

**Review focus:** initiative-order tie-breaking (initiative DESC, sortOrder ASC, createdAt ASC), `nextTurn` wrap semantics inside the same TX as `tickRound`, `chromeVisible` interaction with `RoundViewer`.

### 8.4 PR 4 — Polish + finish

**Goal:** ship the finalisation / confirm / overlap indicator / shortcuts-modal registry / housekeeping.

**Files added / changed (~12, ~450 lines):**

- `app/editor/EditorClient.tsx` (+40) — confirm dialog for "Finalizar combate" and "Dismiss" forced; bind `C` to the new combat toggle; show overlap count in the marker tooltip ("N effects aquí").
- `src/canvas/components/EffectsLayer.tsx` (+30) — marker-blocked-by-wall vignette (a soft inner stroke on the marker edge cells that are immediately behind a wall cell, to communicate "light does not bend").
- `components/ShortcutsModal.tsx` (+25) — add a "Combate" section to the registry listing (handled automatically by `listShortcuts()` once `ShortcutCategory: 'combat'` exists; this PR is just about the icon + label).
- `components/ShortcutsModal.tsx` (+15) — `CATEGORY_META` and `CATEGORY_ORDER` updates for the new `combat` category.
- `app/editor/hooks/use-ops-buffer.ts` (+10) — coalesce consecutive `setScenarioName` ops (already done in PR 1 baseline, but the final pass adds the same coalesce for `relabelEffect`).
- `app/editor/EditorClient.tsx` (+60) — `dispatchTickRound()` helper used by the manual advance path so the wrap-on-last-combatant path inside `nextTurn` and the `R` shortcut share one code path.
- `src/canvas/components/EffectsModal.tsx` (+40) — duplicate-label warning ("Ya existe un efecto con esta etiqueta; revisa la regla PF1e de no-apilamiento de hechizos idénticos"). Non-blocking, advisory only.
- `src/canvas/components/CombatModal.tsx` (+30) — same duplicate-name warning for combatants (advisory).
- `docs/architecture/...` (+30) — short note appended to `entity-file-pattern.md` describing the new entity files (the `ScenarioEffect` and `Combat` five-file splits).
- `openspec/changes/effects-and-combat-tracker/` (+50) — `tasks.md` updated with the final per-PR check marks; `proposal.md` linked from `README.md`; no spec changes (this proposal is the spec until tasks runs).
- `prisma/seed.ts` (if it exists; otherwise a one-off dev script) (+20) — add a smoke-test scenario with a `Combat` + 3 `Combatant`s and 2 `ScenarioEffect`s so a reviewer can spin up `pnpm db:reset` and see a working state.

**Estimated total:** ~450 lines. The 600-line cap is comfortably respected; this PR is the lightest because no schema or persistence change is required.

**Review focus:** confirm dialog accessibility, vignette performance (it must not trigger a re-render on every pan), shortcut registry ordering.

## 9. Risks

### 9.1 Work-unit discipline in PR 2 (modal + walls + overlap + shortcut is the densest)

PR 2 is the highest-risk PR by line density (~580 lines, just under the 600 cap). The modal accessibility surface alone (focus trap, escape, scroll lock, screen-reader announcements) is ~80 lines of CSS module + handler. The wall-aware BFS for cones and lines shares the `eraseFootprintFor` path but the cone direction math is non-trivial; cones need a 90° fan from the origin up to `depthM` cells, projected onto integer grid cells. Mitigation:

- Land the wall-aware BFS for bursts first (reuses `eraseFootprintFor` 1:1), then add cones, then lines. This sequencing matches the function-call order in the natural reading of the code.
- Defer the alpha-blend cap to PR 4 if the cap maths push PR 2 over 600 lines; the un-capped blend is acceptable for v1.

### 9.2 PF1e stack rule is non-binding without a catalog

The PF1e "identical spells do not stack, take the stronger" rule cannot be enforced without a spell catalog. The modal warns on duplicate labels but does not block; this is documented in the success criteria and in `docs/architecture/entity-file-pattern.md` (no enforcement note). The risk is twofold: (a) the GM may paint two overlapping fireballs and the second will visually appear to double the area; (b) if a future PR adds a catalog, it will need to retro-fit a `spellId` field on `ScenarioEffect`. Mitigation: the modal warning copy is unambiguous ("Esta regla es no-vinculante sin catálogo de hechizos") and the `color` field gives the GM a manual override per-marker.

### 9.3 Cross-floor wrap semantics depend on `applyOps` ordering in a TX

`nextTurn` triggers `tickRound` of every effect on the scenario — including effects on floors the GM is not currently looking at. The semantics only hold if `tickRound` runs inside the same `runInTx` as the `nextTurn` op. If a future refactor moves `tickRound` to a separate Server Action (e.g. for performance), the cross-floor wrap is lost. Mitigation: the `applyOp` switch in `scenario.repository.ts` is the single point of truth for `tickRound` invocation; a code comment will mark it as the only legal caller. The `scenarioEffect.repository.ts#tickRoundInTx` is intentionally NOT exported as a standalone use case.

### 9.4 Cache-tag invalidation for the new entity

The `findByIdWithEffectsAndCombat` read uses `cacheTag('pathfinder:scenarios', 'pathfinder:scenario:${id}')`. The existing `saveScenarioOps` action already calls `updateTag('pathfinder:scenario:${result.id}')` after a successful replay, so the new fields are invalidated by the same call. If a future refactor splits the read into two cached functions, both must be tagged with the scenario id. Mitigation: a single `findByIdWithEffectsAndCombat` use case today; splitting is a future PR.

### 9.5 Effect geometry correctness on cones and lines

`eraseFootprintFor` is raster-based (Bresenham 8-connected). Cones and lines in PF1e are 5-ft squares projected from the origin. The first implementation may over- or under-shoot the "true" cone by one cell along the diagonal. Mitigation: PR 2 ships a "wider" cone (over-inclusive by one cell) rather than a "narrower" one — under-inclusive would silently hide cells the GM needs to see. PR 4 refines if playtesting surfaces the over-inclusion.

### 9.6 `nextTurn` rebase on `addCombatant`

`addCombatant` recomputes the initiative-ordered list and re-bases `currentTurnIndex` so the same combatant stays highlighted. The rebase arithmetic is sensitive to ties (equal initiative + equal `sortOrder` → fall back to `createdAt`). If `sortOrder` is not updated when combatants are re-inserted (e.g. a future "reorder" feature), the rebase becomes unstable. Mitigation: the `applyOp` arm for `addCombatant` reads the current `sortOrder` of the inserted row, derives a new value from the current max + 1, and writes the row in the same TX.

## 10. Rollback

Each PR can be reverted independently without leaving the build broken. The contract:

### 10.1 Revert PR 1 (effects persistence + minimal render)

- The `ScenarioEffect` table is dropped via `prisma migrate rollback` (Prisma keeps the migration in `prisma/migrations/`).
- The `EffectsLayer` is removed from `FloorCanvas.tsx`; the file returns to its pre-change state. `useScenarioEffects` and the read-back use case become dead code and can be deleted in a follow-up cleanup PR.
- The 5 effect op variants remain in the schema but are dead — clients cannot reach the `applyOp` arms. Acceptable for a revert; a follow-up cleanup removes them.

### 10.2 Revert PR 2 (modal + tool + walls + overlap)

- The `EffectsModal` and its CSS module are deleted.
- The 5 effect op arms added in `scenario.repository.ts#applyOp` are removed; the schema entries stay (dead, see 10.1).
- The wall-aware BFS in `EffectsLayer` reverts to a non-wall-aware path; the marker simply renders the rectangular footprint. The PR 1 burst still works.
- The `Shift+E` shortcut entry is removed from `lib/shared/constants/shortcuts.ts`.

### 10.3 Revert PR 3 (combat tracker)

- The `Combat` and `Combatant` tables are dropped via Prisma rollback.
- The `RoundViewer` is removed from `EditorClient.tsx`; the combat indicator in `floatingHeader` is removed.
- The 8 combat op variants in the schema are dead (see 10.1). The 5 new shortcut entries (`C`, `N`, `J`, `R`, `K`) are removed.
- The `nextTurn → tickRound` cross-floor wrap is gone; this is the single behaviour that disappears. The PR 1 `tickRound` op arm survives, but with no UI surface to trigger it (the modal — added in PR 2 — only creates / edits / dismisses effects; it does not expose a "tick" button). Until the GM re-installs an explicit `tickRound` trigger, effects stop decrementing on round advance. This is a known gap documented in the revert runbook.

### 10.4 Revert PR 4 (polish + finish)

- The duplicate-label warning, marker-blocked-by-wall vignette, and the "Combate" section in the `ShortcutsModal` are all removable as a unit. The app continues to function.
- The `dispatchTickRound` helper is inlined back into the `R` shortcut handler in `EditorClient.tsx`; no schema change is required.

### 10.5 Disable paths without reverting

For incident response (e.g. the new Layer is causing a Konva perf regression in production):

- **Disable the effects Layer** by setting a feature flag in `lib/shared/constants/effects.ts` (`ENABLE_EFFECTS_LAYER = false`) and guarding the JSX in `FloorCanvas.tsx`. The schema and ops are untouched; the GM keeps their effect rows but cannot see them. Re-enabling is a config flip.
- **Disable `tickRound` of effects** by setting a `TICK_ROUND_ENABLED = false` guard at the top of the `tickRound` arm in `scenario.repository.ts#applyOp`. The combat wrap still increments `currentRound` and re-bases `currentTurnIndex`; only the effect-decrement side-effect is suppressed. Re-enabling is a config flip.
- **Disable combat finalisation** by guarding the `endCombat` arm in the same switch with a `COMBAT_FINALISATION_ENABLED = false`. The combat modal can still be opened; the GM can still run combat; they just cannot end it. Re-enabling is a config flip.

## 11. Success criteria

Each criterion is a single observable behaviour the reviewer can verify by hand against `pnpm dev` on a clean DB.

1. **Marker creation persists.** GM clicks the new "Efectos" button, fills in the modal with a label "Tirada de fuego", `kind: 'burst'`, dimensions 3×3, `color: '#ff6b35'`, `remainingRounds: 5`, and saves. After a hard reload of `/editor?id=…`, the same burst renders in the same cells with the same colour and the same `remainingRounds: 5`.
2. **Round advance decrements.** GM presses `R` (manual advance round). The `RoundViewer` round counter increments by 1. The burst re-renders with `remainingRounds: 4`. Pressing `R` four more times brings the burst to `remainingRounds: 0`, after which it is rendered with reduced opacity + a clock-strikethrough icon until the GM dismisses it from the modal.
3. **Combat wrap ticks effects.** GM starts combat with two combatants (initiative 18, 15). The first turn is combatant 18. Pressing `N` advances to combatant 15. Pressing `N` again wraps — `currentRound` becomes 2, `currentTurnIndex` resets to combatant 18, and every effect on the scenario is decremented by 1 in the same transaction.
4. **Cross-floor effects tick on global round.** GM has an effect on `Planta Baja` and another on `Piso 1`. After a combat wrap, both effects are decremented by 1, regardless of which floor the GM is currently viewing. The DB row reflects this within the same `applyOpsInTx` call.
5. **`chromeVisible` does not hide the Round Viewer.** GM presses `H` (existing `toggleChrome` shortcut). The toolbar and the floating header collapse to invisible, but the `RoundViewer` remains visible at the bottom-centre.
6. **End combat cascades.** GM presses `C` to end combat. A confirm dialog appears. On confirm, the `Combat` row and its `Combatant[]` rows are deleted; the next save succeeds; the home page (`/`) shows the scenario name without an error.
7. **Wall-aware burst.** GM paints a wall on `Planta Baja` between two cells of a 3×3 burst. The cells behind the wall (from the burst's origin) are NOT rendered as part of the burst. Cells in front of and lateral to the wall are.
8. **No `pnpm test` invocation.** Reviewer greps the PR diff for `pnpm test`; the result is empty. `AGENTS.md` §3 and `openspec/config.yaml#testing.forbidden_test_commands` are respected.
9. **All four PRs pass the 600-line budget.** `git diff --stat origin/main...HEAD` on each PR shows `< 600` changed lines.
10. **All four PRs pass `pnpm typecheck`, `pnpm lint`, `pnpm check`.** CI (or the reviewer's local `pnpm check`) is green on the head of each PR.

## 12. Open assumptions to confirm

No open product assumptions. The proposal-question round (handled by the parent) already locked the three product questions — combat multi-floor behaviour, expired-effect behaviour, and effect colour accessibility. The remaining items (render order, BFS reuse, cross-floor combat semantics, combat end purges, Round Viewer ignoring `chromeVisible`, shortcut list, no token-bound, no catalog, concentration visual, colour picker override, no tests) are either explicit user-stated decisions from the proposal-question round or are technical / structural decisions that follow from the existing code paths and the user-stated decisions.

Items the spec / design phases should still verify but do not require a product question:

- The `Side` enum (`0 = PC`, `1 = monster`, `2 = NPC ally`) maps to the three side pills in the `RoundViewer`. Confirmed by the parent.
- The `casterLevelHint: Int?` field is advisory only and is not surfaced in the v1 modal. It is included in the schema for forward-compatibility.
- The `nextTurn` wrap → `tickRound` path uses the `updateMany` form against `scenarioEffect` to keep the TX fast. Spec phase should confirm the index choice (`@@index([scenarioId])`) makes this `O(effects)`.
