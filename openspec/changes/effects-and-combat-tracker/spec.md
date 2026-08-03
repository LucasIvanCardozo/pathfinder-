# Effects and Combat Tracker — Behavioral Specification

**Status:** Approved behavioral specification for implementation and manual review. This file specifies verifiable outcomes from the locked proposal; it does not re-lock, amend, or replace the proposal.

## 1. Scope reference

Source of truth: [`proposal.md`](./proposal.md).

- Persist floor-scoped burst, cone, line, and wall AoE markers through the scenario operation autosave flow.
- Render markers with wall-aware geometry, overlap feedback, duration state, and GM editing actions.
- Provide one scenario-wide initiative tracker whose round advances tick effects on every floor.
- Deliver the behavior in the four chained PR slices defined by the proposal.

## 2. Glossary

- **AoE (area of effect):** A persistent, labelled `ScenarioEffect` covering grid cells on exactly one floor.
- **Caster level (CL):** The PF1e caster level used by the GM to calculate a spell duration. `casterLevelHint` is advisory bookkeeping only; the GM supplies the final round count.
- **Initiative count:** A combatant's integer initiative value and position in the single scenario-wide ordered turn list.
- **Burst / cone / line / wall:** The four supported AoE shapes. A burst expands around an anchor; a cone fans from it; a line extends in a direction; a wall occupies an oriented extent.
- **`currentTurnIndex`:** Zero-based pointer into combatants sorted by `initiative DESC, sortOrder ASC, createdAt ASC`.
- **`tickRound`:** A discrete scenario operation that decrements every positive `remainingRounds` value in the scenario once and marks values reaching zero as expired.
- **`applyOpsInTx`:** The repository transaction that validates and applies one autosave batch atomically, including effect ticks caused by a round advance or turn-list wrap.
- **`RoundViewer`:** The persistent bottom-centre combat control showing the global round and current combatant.
- **`chromeVisible`:** The existing editor chrome visibility flag. It MUST NOT control or inert the `RoundViewer`.

## 3. Feature A — Persistent AoE markers

### Requirement A1: Locked render order

The editor MUST render the effects `Konva.Layer` before `cellsBySub.map(...)`; existing obscured-darkness cells MUST remain above markers, and the brush preview MUST remain above both.

- **Observable behavior:** Markers remain visible with terrain context, are hidden by obscured darkness, and do not cover the brush preview.
- **Trigger:** The GM opens a floor containing a persisted effect and paints or toggles darkness over it.
- **Persisted state:** Rendering MUST read the existing `ScenarioEffect` rows without changing them; darkness and terrain retain their existing persistence behavior.
- **Acceptance criterion:** In the browser, darkness hides the covered part of a marker while the brush preview remains visible at the pointer.

#### Scenario: Darkness obscures a marker

- GIVEN a persisted marker and obscured cells occupy the same coordinates
- WHEN the floor is rendered
- THEN the obscured cells MUST appear above the marker and the brush preview MUST remain topmost

### Requirement A2: Locked wall-aware geometry reuse

AoE reachability MUST match the existing `eraseFootprintFor` wall semantics, using structure cells as walls and without defining a divergent reachability rule.

- **Observable behavior:** A wall blocks cells behind it from the marker footprint while reachable front and lateral cells remain visible.
- **Trigger:** The GM paints `estructuras` cells across an effect's geometric footprint.
- **Persisted state:** The effect's dimensions and anchor MUST remain unchanged; the painted structure cells determine the rendered reachable subset.
- **Acceptance criterion:** In the browser, painting a wall removes only wall-blocked cells from the visible marker footprint.

#### Scenario: Wall blocks propagation

- GIVEN a burst, cone, line, or wall marker crosses a structure cell
- WHEN the floor re-renders after the structure paint
- THEN the marker MUST include only cells reachable under `eraseFootprintFor` semantics

### Requirement A3: Locked overlap composition

The renderer MUST alpha-compose overlapping marker colors with a maximum combined alpha of `0.7`; a clicked overlap MUST report `N effects aquí` when `N > 1`.

- **Observable behavior:** Overlap is visually stronger but never exceeds 0.7 alpha, and its tooltip reports the number of effects at that cell.
- **Trigger:** The GM creates or moves the view to two or more markers whose visible footprints share a cell, then clicks the overlap.
- **Persisted state:** Each effect MUST remain an independent row with its own color; overlap MUST NOT create a merged row.
- **Acceptance criterion:** In the browser, an overlap remains translucent and its tooltip says, for example, `2 effects aquí`.

#### Scenario: Two marker colors overlap

- GIVEN two visible effect footprints share a cell
- WHEN the cell is rendered and clicked
- THEN their colors MUST be alpha-composed up to 0.7 and the tooltip MUST report both effects

### Requirement A4: Locked round decrement and expiry

Each accepted `tickRound` MUST decrement every scenario effect with `remainingRounds > 0` exactly once, across all floors, clamp the value at zero, and set `expired = true` when zero is reached. It MUST NOT delete expired rows.

- **Observable behavior:** A positive duration falls by one per global round; at zero the marker remains with reduced opacity and a clock-strikethrough icon.
- **Trigger:** The GM advances a round with `R`, explicitly queues `tickRound`, or advances from the final combatant so `nextTurn` wraps.
- **Persisted state:** A `tickRound` op, or wrapping round operation, MUST update all affected `ScenarioEffect` rows inside the same `applyOpsInTx` transaction.
- **Acceptance criterion:** In the browser, one round advance changes `1` to `0` and changes the marker to its expired visual without removing it.

#### Scenario: Effect reaches zero

- GIVEN an effect has `remainingRounds = 1` and `expired = false`
- WHEN one round tick is committed
- THEN it MUST have `remainingRounds = 0`, `expired = true`, and remain available for dismissal

### Requirement A5: Locked list-and-editor modal

The `Efectos` modal MUST present an active-floor effect list and an editor for label, kind, anchor, dimensions, rotation where applicable, color, duration kind, and remaining rounds. It MUST support create, select, edit, and dismiss flows without introducing a spell catalog.

- **Observable behavior:** Selecting a list item shows its current persisted values; `Añadir efecto` opens a blank/defaulted editor; `Guardar` applies valid changes.
- **Trigger:** The GM clicks `Efectos` or presses `Shift+E` while no modal is open, then chooses or creates an effect.
- **Persisted state:** Saving MUST queue the applicable effect operation or atomic operation batch in `useOpsBuffer`; the next autosave MUST send it through `saveScenarioOps`.
- **Acceptance criterion:** In the browser, the modal lists only active-floor effects and reopening it shows the values most recently saved.

#### Scenario: Create through the modal

- GIVEN the `Efectos` modal is open on a floor
- WHEN the GM clicks `Añadir efecto`, fills valid fields, and clicks `Guardar`
- THEN the new marker MUST appear on that floor and in the modal list

### Requirement A6: Locked palette and color override

Each shape MUST default to its configured palette color, and the modal MUST allow a valid color-picker override stored in the same `color` field.

- **Observable behavior:** Changing kind selects that kind's default for a new effect; choosing another color makes the marker use the override after save and reload.
- **Trigger:** The GM creates an effect, selects a kind, optionally changes `<input type="color">`, and clicks `Guardar`.
- **Persisted state:** The chosen hex color MUST be stored on the `ScenarioEffect` row and carried by the buffered `addEffect` data.
- **Acceptance criterion:** In the browser, a hard reload preserves the exact selected marker color.

#### Scenario: Override the palette default

- GIVEN a new cone has its palette default
- WHEN the GM selects a different valid color and saves
- THEN the cone MUST render with and persist the override

### Requirement A7: `addEffect` operation

`addEffect` MUST have shape `{ type: 'addEffect', effect: ScenarioEffectInsert }` and create exactly one effect belonging to the target scenario and floor. The insert MUST carry its ID, scenario and floor IDs, label, kind, integer anchor and dimensions, rotation, valid hex color, duration kind, non-negative `remainingRounds`, expiry state, and optional advisory `casterLevelHint` when supplied.

- **Observable behavior:** A valid save creates one marker; invalid input shows actionable validation feedback and creates none.
- **Trigger:** The GM clicks `Añadir efecto`, completes the editor, and clicks `Guardar`.
- **Persisted state:** One `ScenarioEffect` row MUST be created; `useOpsBuffer` MUST record one `addEffect` op; `saveScenarioOps` MUST ship it in the next autosave tick.
- **Acceptance criterion:** In the browser, a valid marker appears once and survives reload; invalid data leaves the canvas and list unchanged.

Expected validation errors MUST include missing required fields, empty label, unsupported `kind` or `durationKind`, malformed color, non-integer coordinates/dimensions/rotation/round count, non-positive dimensions, negative rounds, a floor outside the target scenario, or an already-used effect ID. Validation MUST report all relevant field issues available from the boundary parse and MUST NOT partially persist the op.

#### Scenario: Reject malformed add data

- GIVEN an `addEffect` has an unsupported kind, malformed color, and negative round count
- WHEN the operation is validated
- THEN it MUST be rejected with field-level issues and MUST create no row

### Requirement A8: `removeEffect` operation and cascades

`removeEffect` MUST have shape `{ type: 'removeEffect', effectId: string }` and hard-delete only the identified effect in the target scenario. Deleting a floor MUST delete all its effects through `onDelete: Cascade`; deleting the scenario MUST likewise leave no related effects.

- **Observable behavior:** Removing one effect makes only that marker disappear; deleting its floor removes every marker on that floor.
- **Trigger:** The GM confirms removal, clears a floor, or clears the whole scenario.
- **Persisted state:** An explicit removal MUST queue `removeEffect`; floor/scenario deletion MUST rely on the relational cascade and MUST leave no orphan rows.
- **Acceptance criterion:** In the browser, removed or cascaded markers do not return after reload.

#### Scenario: Floor deletion cascades

- GIVEN a floor owns multiple effects and another floor owns one effect
- WHEN the first floor is deleted
- THEN only the first floor's effects MUST be deleted

### Requirement A9: Explicit `tickRound` operation

`tickRound` MUST have shape `{ type: 'tickRound' }`. Every occurrence MUST represent one tick; consecutive ticks MUST NOT be coalesced, and zero/expired effects MUST remain unchanged and present.

- **Observable behavior:** Two explicit round ticks reduce a positive duration by two, not one and not more than two.
- **Trigger:** Two separate round advances are accepted.
- **Persisted state:** Two discrete ops MUST be applied in order inside autosave transactions; each MUST update eligible scenario effects once.
- **Acceptance criterion:** In the browser, an effect at 4 rounds shows 2 rounds after exactly two advances.

#### Scenario: Tick is discrete

- GIVEN an effect has four remaining rounds
- WHEN two `tickRound` operations are applied
- THEN it MUST have two remaining rounds

### Requirement A10: `relabelEffect` operation and duplicate warning

`relabelEffect` MUST have shape `{ type: 'relabelEffect', effectId: string, label: string }` and update only the label of the identified effect. A duplicate label anywhere in the same scenario MUST produce a non-blocking PF1e stack-rule warning, including when the other effect is on another floor.

- **Observable behavior:** The label changes after save; a duplicate warns but `Guardar` remains available.
- **Trigger:** The GM edits a label or creates a second same-label effect.
- **Persisted state:** `useOpsBuffer` MUST record `relabelEffect`; autosave MUST persist the new label without merging or removing either effect.
- **Acceptance criterion:** In the browser, both same-label effects remain and a warning appears for the second.

#### Scenario: Duplicate labels are advisory

- GIVEN one scenario effect is labelled `Fireball`
- WHEN the GM saves another effect with label `Fireball`
- THEN the modal MUST warn and MUST still allow both independent effects to persist

### Requirement A11: `dismissEffect` operation and render filtering

`dismissEffect` MUST have shape `{ type: 'dismissEffect', effectId: string }` and hard-delete the identified effect. The active editor view MUST exclude a dismissed effect from the modal list, tooltip aggregation, and rendered footprints.

- **Observable behavior:** Dismissal removes the marker and decrements any overlap count immediately in the editor state.
- **Trigger:** The GM selects `Dismiss` or `Dispel Magic` for a marker and confirms when confirmation is presented.
- **Persisted state:** The editor MUST queue `dismissEffect`; autosave MUST delete the row, and reload MUST not restore it.
- **Acceptance criterion:** In the browser, the dismissed marker disappears from every effect surface and stays absent after reload.

#### Scenario: Dismiss one overlapping effect

- GIVEN three effects overlap a cell
- WHEN one is dismissed
- THEN only two MUST render there and the tooltip MUST report `2 effects aquí`

### Requirement A12: Marker tooltip actions

Clicking a visible marker MUST open a tooltip with its label, remaining/expired state, and `Editar`, `Dismiss`, and `Dispel Magic` actions. `Editar` MUST open the current record in the editor; both ending actions MUST use the explicit dismissal semantics rather than silently expiring the row.

- **Observable behavior:** The three actions are available from the selected marker; edit preserves saved values and dismissal removes the marker.
- **Trigger:** The GM clicks a marker or an overlap entry and chooses an action.
- **Persisted state:** Editing MUST persist the resulting effect state through supported effect ops; `Dismiss` and `Dispel Magic` MUST queue `dismissEffect`.
- **Acceptance criterion:** In the browser, each tooltip action reaches the named flow for the selected effect and never affects a neighboring effect.

#### Scenario: Edit from marker tooltip

- GIVEN a marker is visible
- WHEN the GM clicks it and selects `Editar`
- THEN the modal MUST open with that effect's latest values

### Requirement A13: Blocked anchor and empty footprint

If an effect's anchor is itself a structure cell, wall-aware reachability MUST return an empty marker footprint, matching `eraseFootprintFor`. Whenever all footprint cells are unreachable, the anchor cell MUST show the small `marker bloqueado por muro` vignette instead of fabricating a visible AoE cell.

- **Observable behavior:** Overpainting the anchor with a wall removes the footprint and leaves only the blocked-marker vignette at the anchor.
- **Trigger:** The GM paints a structure on the effect anchor or walls off every candidate cell.
- **Persisted state:** The `ScenarioEffect` row and anchor coordinates MUST remain unchanged; only the derived render footprint changes.
- **Acceptance criterion:** In the browser, the AoE fill is empty and the anchor displays the blocked-by-wall vignette.

#### Scenario: Anchor becomes a wall

- GIVEN an existing marker has a reachable footprint
- WHEN a structure is painted on its anchor cell
- THEN the footprint MUST become empty and the anchor vignette MUST render

### Requirement A14: Cross-floor effect war-game

One global round event MUST tick all eligible effects in the scenario, including effects on `Planta Baja` and `Piso 1`, regardless of the floor currently shown.

- **Observable behavior:** Effects on both floors lose one round after a single combat wrap.
- **Trigger:** The GM advances from the last combatant to the first while viewing either floor.
- **Persisted state:** The wrapping `nextTurn` and all effect updates MUST commit in one `applyOpsInTx` transaction against the scenario, not separate floor transactions.
- **Acceptance criterion:** In the browser, switching floors after one wrap shows both effects decremented once and the same global round number.

#### Scenario: One wrap ticks two floors

- GIVEN one positive-duration effect exists on each of two floors
- WHEN the global initiative list wraps once
- THEN both effects MUST decrement once and no floor-specific counter MUST exist

## 4. Feature B — Combat tracker

### Requirement B1: `startCombat` operation

`startCombat` MUST have shape `{ type: 'startCombat' }`, create at most one `Combat` for the scenario, and initialize `currentRound = 1` and `currentTurnIndex = 0`. The unique `Combat.scenarioId` constraint MUST prevent a second combat. Combatant ownership MUST use `Combatant.combatId → Combat.id` with `onDelete: Cascade`.

- **Observable behavior:** Starting combat shows round 1 with pointer 0; a second start cannot create a duplicate tracker.
- **Trigger:** The GM clicks the start-combat control or presses `C` while no combat and no modal exist, then completes or confirms the flow.
- **Persisted state:** `useOpsBuffer` MUST queue `startCombat`; autosave MUST create one `Combat` row in `applyOpsInTx`.
- **Acceptance criterion:** In the browser, combat starts at round 1 and remains the same single combat after reload.

#### Scenario: Start a new combat

- GIVEN the scenario has no combat
- WHEN `startCombat` is applied
- THEN exactly one combat MUST exist with round 1 and turn index 0

### Requirement B2: `endCombat` operation and cascade

`endCombat` MUST have shape `{ type: 'endCombat' }` and delete the scenario's `Combat`; deletion MUST cascade through `Combatant.combatId` to every related combatant. No archive or historical row may remain.

- **Observable behavior:** After confirmation, combat UI disappears and a later start begins a fresh round 1.
- **Trigger:** The GM chooses `Finalizar combate` or presses `C` during combat and confirms.
- **Persisted state:** The end operation MUST delete the `Combat` and all `Combatant` rows atomically; the save-then-purge flow MUST complete before stale combat UI is restored.
- **Acceptance criterion:** In the browser, ending combat removes the viewer and all old participants, including after reload.

#### Scenario: End purges participants

- GIVEN a combat has three combatants
- WHEN `endCombat` commits
- THEN the combat and all three combatants MUST be absent

### Requirement B3: `nextTurn` operation

`nextTurn` MUST have shape `{ type: 'nextTurn' }`. With combatants present it MUST advance one sorted position; advancing past the last MUST set `currentTurnIndex = 0`, increment `currentRound` once, and invoke one scenario-wide `tickRound` in the same transaction.

- **Observable behavior:** Intermediate turns change only the combatant; a wrap changes the combatant, round, and effect durations together.
- **Trigger:** The GM clicks Next or presses `N` while combat is active and no modal is open.
- **Persisted state:** One `nextTurn` op MUST atomically persist the pointer and, on wrap only, the round increment and one effect tick.
- **Acceptance criterion:** In the browser, pressing Next on the last combatant shows the first combatant, the next round, and durations reduced exactly once.

#### Scenario: Next wraps the order

- GIVEN a two-combatant order is on index 1 in round 3
- WHEN `nextTurn` is applied
- THEN the index MUST be 0, the round MUST be 4, and effects MUST tick once

### Requirement B4: `previousTurn` operation

`previousTurn` MUST have shape `{ type: 'previousTurn' }`. It MUST decrement a positive pointer by one; from index 0 it MUST snap to `combatantCount - 1` without changing `currentRound` and without ticking or restoring effect duration.

- **Observable behavior:** Previous moves the highlight backward, including wrapping to the last combatant, while round and effects remain unchanged.
- **Trigger:** The GM clicks Previous or presses `J` while no modal is open.
- **Persisted state:** One `previousTurn` op MUST update only `currentTurnIndex` in this behavior.
- **Acceptance criterion:** In the browser, Previous from the first combatant highlights the last with the same round and effect durations.

#### Scenario: Previous wraps without time reversal

- GIVEN round 4 is on index 0 with three combatants
- WHEN `previousTurn` is applied
- THEN the index MUST be 2, round MUST remain 4, and no effect MUST tick

### Requirement B5: `addCombatant` operation and pointer rebase

`addCombatant` MUST have shape `{ type: 'addCombatant', combatant: CombatantInsert }`. It MUST assign a monotonic `sortOrder`, insert by the canonical sort, and preserve the identity of the previously current combatant. If the new initiative is greater than or equal to the current combatant's initiative, it appears before current and the pointer MUST rebase so no turn is skipped; otherwise it appears after current and MUST not receive a retroactive turn in the current cycle.

- **Observable behavior:** Adding a participant never changes which existing combatant is currently highlighted.
- **Trigger:** The GM opens add-combatant, supplies label, initiative, and side, and saves.
- **Persisted state:** One combatant row MUST be inserted and `currentTurnIndex` MUST be updated when the inserted sorted position is before or at the current pointer.
- **Acceptance criterion:** In the browser, the same combatant remains highlighted after insertion and the new row appears in initiative order.

#### Scenario: Higher initiative inserts before current

- GIVEN initiative 15 is current
- WHEN initiative 18 is added
- THEN 18 MUST appear before 15 and the pointer MUST still identify 15

### Requirement B6: `removeCombatant` operation and pointer rebase

`removeCombatant` MUST have shape `{ type: 'removeCombatant', combatantId: string }` and hard-delete one participant. If the removed sorted position was at or before `currentTurnIndex`, the pointer MUST decrement by one and clamp at zero; otherwise it MUST remain numerically unchanged. It MUST always be clamped to a valid remaining position.

- **Observable behavior:** Removal does not unexpectedly jump forward over an additional participant.
- **Trigger:** The GM removes a combatant while combat is paused at any pointer.
- **Persisted state:** The combatant row MUST be deleted and the rebased index MUST commit in the same transaction.
- **Acceptance criterion:** In the browser, removing a row at/before current shifts the pointer back by one, never below zero.

#### Scenario: Remove at the current pointer

- GIVEN the current pointer is 2
- WHEN the combatant at sorted position 2 is removed
- THEN `currentTurnIndex` MUST become 1 and remain valid

### Requirement B7: Canonical initiative ordering

Every combat surface and turn operation MUST use `initiative DESC, sortOrder ASC, createdAt ASC`. `sortOrder` MUST be assigned monotonically on insert and MUST be the stable first tie-breaker.

- **Observable behavior:** Higher initiative appears first; equal initiatives retain stable insertion order even after reload.
- **Trigger:** The GM adds combatants with equal and unequal initiative values.
- **Persisted state:** Each inserted row MUST retain its monotonic `sortOrder` and `createdAt`; reads MUST not rewrite either value.
- **Acceptance criterion:** In the browser, tied combatants remain in the same order before and after reload.

#### Scenario: Equal initiative is stable

- GIVEN two initiative-18 combatants were inserted in sequence
- WHEN the combat list is loaded repeatedly
- THEN the lower `sortOrder`, then earlier `createdAt`, MUST appear first

### Requirement B8: `RoundViewer` ignores hidden chrome

While combat exists, `RoundViewer` MUST remain visible and operable when `chromeVisible = false`.

- **Observable behavior:** Hiding editor chrome removes the chrome surfaces but leaves the bottom-centre viewer visible.
- **Trigger:** The GM starts combat and uses the existing chrome toggle.
- **Persisted state:** The toggle MUST NOT modify combat state or queue combat ops.
- **Acceptance criterion:** In the browser, the viewer remains on screen after the header and toolbars hide.

#### Scenario: Viewer survives chrome toggle

- GIVEN combat is active
- WHEN `chromeVisible` becomes false
- THEN `RoundViewer` MUST remain visible and MUST NOT become inert

### Requirement B9: Header combat indicator

When `chromeVisible = true` and combat exists, the existing floating header MUST show the current round, current combatant label, and side pill beside autosave status.

- **Observable behavior:** The header reflects the same current combatant and round as `RoundViewer`.
- **Trigger:** Combat starts, advances, rewinds, or changes participants while chrome is visible.
- **Persisted state:** The indicator MUST derive from persisted/buffered combat state and MUST create no independent state row.
- **Acceptance criterion:** In the browser, header and viewer always display the same round and current participant.

#### Scenario: Header follows next turn

- GIVEN chrome is visible during combat
- WHEN the turn advances
- THEN both combat indicator surfaces MUST update to the same combatant

### Requirement B10: Manual round advance

`advanceRound` MUST have shape `{ type: 'advanceRound' }`, increment `currentRound` once, set `currentTurnIndex = 0`, and tick every eligible scenario effect once in the same transaction.

- **Observable behavior:** Manual advance starts the next round at the first combatant and decrements effects once.
- **Trigger:** The GM clicks advance-round or presses `R` while no modal is open.
- **Persisted state:** One `advanceRound` op MUST atomically persist round, pointer, and effect updates.
- **Acceptance criterion:** In the browser, one manual advance raises the round by one, selects the first participant, and reduces each positive effect once.

#### Scenario: Advance round explicitly

- GIVEN combat is on round 2 and a later combatant
- WHEN `advanceRound` is applied
- THEN round MUST become 3, index MUST become 0, and effects MUST tick once

### Requirement B11: Zero-combatant operations

A combat with zero combatants MUST retain `currentTurnIndex = 0`. `nextTurn` MUST be a no-op and display the toast `Combate sin combatientes`; previous and manual pointer movement MUST NOT create an invalid index.

- **Observable behavior:** The viewer remains stable and explains why Next did nothing.
- **Trigger:** The GM starts empty combat and invokes Next.
- **Persisted state:** No pointer, round, or effect row MUST change; the rejected/no-op action MUST not enqueue an effect tick.
- **Acceptance criterion:** In the browser, Next leaves round and pointer unchanged and shows `Combate sin combatientes`.

#### Scenario: Next in empty combat

- GIVEN active combat has no combatants
- WHEN Next is invoked
- THEN it MUST be a no-op with the specified toast

### Requirement B12: Combat keyboard shortcuts and modal guard

The combat shortcut registry MUST contain the following bindings under category `combat`. Every binding MUST have no effect while any modal is open, including no operation queued, no confirmation opened behind the modal, and no modal replacement.

| Shortcut | Normal behavior when no modal is open | Required modal-open behavior |
|---|---|---|
| `Shift+E` | Toggle `Efectos` modal | No effect |
| `C` | Start combat, or request confirmed end of active combat | No effect |
| `N` | Queue `nextTurn` | No effect |
| `J` | Queue `previousTurn` | No effect |
| `R` | Queue `advanceRound` | No effect |
| `K` | Open add-combatant form during combat | No effect |

- **Observable behavior:** Each shortcut performs its named action only when the editor has no open modal.
- **Trigger:** The GM presses each shortcut first with no modal, then while a modal is open.
- **Persisted state:** Normal mutation shortcuts MUST queue their corresponding ops; guarded presses MUST change no buffered or persisted state.
- **Acceptance criterion:** In the browser, all six keys are inert while a modal is open and resume their documented action after it closes.

#### Scenario: Modal guard suppresses shortcuts

- GIVEN any editor modal is open
- WHEN the GM presses `Shift+E`, `C`, `N`, `J`, `R`, or `K`
- THEN no visible surface, combat/effect state, or operation buffer MUST change

## 5. Cross-cutting behavior

### Requirement C1: Autosave carries every new operation

`useScenarioAutosave` MUST carry `addEffect`, `removeEffect`, `tickRound`, `relabelEffect`, `dismissEffect`, `startCombat`, `endCombat`, `nextTurn`, `previousTurn`, `advanceRound`, `addCombatant`, and `removeCombatant` end-to-end through `useOpsBuffer`, `saveScenarioOps`, `applyOpsInTx`, and Prisma.

#### Scenario: Reload restores effects

- GIVEN effect operations have reached successful autosave
- WHEN the GM hard-reloads `/editor?id=…`
- THEN all surviving effects MUST render on the same floors, anchors, dimensions, colors, labels, and duration states

### Requirement C2: Cache invalidation remains scenario-scoped

After a successful operation save, `saveScenarioOps` MUST call `updateTag('pathfinder:scenario:${id}')`. Existing revalidation scopes MUST remain unchanged; writes MUST NOT substitute `revalidateTag` or broaden cache invalidation.

#### Scenario: Saved scenario read is fresh

- GIVEN an effect or combat operation commits successfully
- WHEN the scenario-tagged read is requested again
- THEN it MUST reflect the committed state through the updated scenario cache tag

### Requirement C3: Undo/redo rebase preserves new operations

When undo or redo calls `markDirtyForRebase`, `useOpsBuffer` MUST reconstruct the outgoing operation batch without silently dropping, duplicating, coalescing, or reordering the new operations. In particular, distinct round ticks MUST remain distinct.

#### Scenario: Undo/redo before autosave

- GIVEN new effect and combat ops are buffered
- WHEN undo or redo marks the editor dirty for rebase
- THEN the next valid save MUST preserve the resulting intended state and every required discrete tick

### Requirement C4: Cleanup cascade boundaries

The existing `CleanModal` (`Limpiar`) and `Limpiar piso` behavior MUST obey these exact boundaries: **Clearing a floor deletes all effects on it. Clearing the whole scenario deletes all effects. Clearing a subdivision does NOT touch effects (effects are floor-scoped, not subdivision-scoped).**

#### Scenario: Clear only a subdivision

- GIVEN a floor has effects and painted cells in one subdivision
- WHEN the GM clears that subdivision
- THEN its cells MAY be removed but every floor-scoped effect MUST remain

## 6. Acceptance checklists per PR

These are manual browser checks; they do not assert automated test coverage.

### PR 1 — Persistence and minimal render

- [ ] Open an existing `/editor?id=…` scenario after the migration → the editor loads with no effect-related error.
- [ ] From browser developer tools, submit one valid burst `addEffect` through the existing scenario save entrypoint → autosave reports success and one marker appears.
- [ ] Hard-reload the same editor URL → the burst returns at the same floor and anchor.
- [ ] Switch to another floor and back → the burst appears only on its owning floor.
- [ ] Inspect a burst under existing obscured darkness → darkness remains above the marker.
- [ ] Move the existing brush preview over the burst → the preview remains above the marker.
- [ ] Submit one malformed `addEffect` from developer tools → validation is reported and no second marker appears.
- [ ] Delete the owning floor through an already-existing floor deletion surface, then reload → its persisted effects do not return.

### PR 2 — Modal, geometry, and overlap

- [ ] Click `Efectos`, then `Añadir efecto`, fill valid fields, and click `Guardar` → the marker and list entry appear.
- [ ] Create one marker of each kind → burst, cone, line, and wall use their selected dimensions and orientation rules.
- [ ] Select a custom color, save, and hard-reload → the marker keeps the exact override.
- [ ] Create an effect with `rounds-concentration` → its footprint has the dashed concentration border.
- [ ] Paint a structure between an anchor and target cells → cells behind the wall disappear while reachable cells remain.
- [ ] Paint a structure directly on an effect anchor → the footprint becomes empty and the blocked-marker vignette appears.
- [ ] Create two overlapping effects and click the overlap → colors remain capped at 0.7 alpha and the tooltip says `2 effects aquí`.
- [ ] Click a marker and choose `Editar` → the modal opens with that marker's latest values.
- [ ] Create a second same-label effect → a warning appears but save remains allowed.
- [ ] Choose `Dismiss` or `Dispel Magic`, then reload → only the selected effect remains absent.

### PR 3 — Combat tracker

- [ ] Click the combat start control and create empty combat → `RoundViewer` shows round 1 and no invalid current participant.
- [ ] Use the visible add-combatant control to add initiatives 18 and 15 → order is 18, then 15.
- [ ] Add another initiative-18 combatant → equal initiatives retain stable insertion order after reload.
- [ ] Use the visible Next control once → initiative 15 becomes current and the round does not change.
- [ ] Use Next again → the order wraps, round becomes 2, and persisted effects tick once.
- [ ] Use Previous from the first participant → the last becomes current without changing the round or effects.
- [ ] Add a higher-initiative participant while 15 is current → 15 remains highlighted after list reordering.
- [ ] Remove a participant at or before the pointer → the pointer decrements once and remains at least zero.
- [ ] Hide editor chrome with the existing control/shortcut → `RoundViewer` remains visible while the header disappears.
- [ ] End combat through its visible control and confirm → the viewer and all old combatants remain absent after reload.

### PR 4 — Polish and integrated behavior

- [ ] Open any modal and press each of `Shift+E`, `C`, `N`, `J`, `R`, and `K` → every key has no effect.
- [ ] Close all modals and press `Shift+E` → the `Efectos` modal toggles normally.
- [ ] With combat active, press `N`, `J`, `R`, and `K` → each performs its registered combat action.
- [ ] Press `C` during combat and cancel finalization → combat and participants remain unchanged.
- [ ] Wrap the initiative order twice in one session → `currentRound` increases twice and effects decrement exactly twice.
- [ ] Keep effects on `Planta Baja` and `Piso 1`, then advance one round → both floors' effects decrement under one global counter.
- [ ] Expire an effect and reopen its editor → both canvas and modal show zero rounds and the expired state.
- [ ] Use `Limpiar piso`, whole-scenario `Limpiar`, and subdivision clear in turn → effect deletion follows the three documented cascade boundaries.

## 7. Out-of-scope reaffirmation

The following is [`proposal.md` §4](./proposal.md#4-non-goals), verbatim:

- **No token-bound conditions / status effects.** Per-piece debuffs, conditions, and HP tracking on painted cells are not in scope. A `PaintedCell` does not gain a `status` field.
- **No hard-coded spell catalog.** The modal is the catalog. Spell templates (e.g. "Burning Hands", "Fireball") were considered and rejected for the first slice.
- **No historical combat archive.** Ending combat purges the `Combat` and `Combatant[]` rows via Prisma `onDelete: Cascade`. There is no log, no replay, no PDF export.
- **No realtime / multi-user sync.** No Soketi, no pusher, no polling. `AGENTS.md` §11 confirms this is out of scope app-wide.
- **No test runner / no claimed coverage.** Validation is `pnpm typecheck | lint | check`. `AGENTS.md` §3 and `openspec/config.yaml#testing.forbidden_test_commands` forbid `pnpm test`.
- **No per-floor combat.** A scenario has exactly one `Combat` row; combatants may originate on any floor but appear in one initiative-ordered list.
- **No automatic stack-rule enforcement.** Distinct AoE spells coexist; identical-label spells warn but do not block. The PF1e "identical spells do not stack, take the stronger" rule is non-binding without a catalog.
- **No auth, no multi-tenancy, no payment, no file upload.** Consistent with `AGENTS.md` §11.
- **No migration of pre-existing scenarios beyond a no-op `addEffect` on first save.** Existing scenarios without effects stay empty.

The spec does not add any `pnpm test` invocation. Any future test runner adoption is a separate proposal.

## 8. Edge cases

### Edge E1: Duplicate effect labels

- GIVEN an effect label already exists anywhere in the scenario
- WHEN the GM creates a second effect with the same label
- THEN the modal MUST warn and MUST NOT block persistence

### Edge E2: Anchor cell removed by structure overpaint

- GIVEN a marker anchor is a currently reachable cell
- WHEN structure painting deletes/overpaints that cell as a wall
- THEN wall-aware reachability MUST become empty and the anchor MUST show the blocked-marker vignette

### Edge E3: Combat has zero participants

- GIVEN combat has no combatants and `currentTurnIndex = 0`
- WHEN Next is invoked
- THEN the pointer MUST remain 0, no tick MUST occur, and toast `Combate sin combatientes` MUST appear

### Edge E4: Remove combatant at or before a paused pointer

- GIVEN combat is paused with a valid nonzero pointer
- WHEN a combatant at or before that index is removed
- THEN `currentTurnIndex` MUST decrement by one and clamp at zero

### Edge E5: Two wraps in one session

- GIVEN the GM traverses the full combat order twice without reloading
- WHEN the final combatant wraps to the first on each traversal
- THEN `currentRound` MUST increment twice and `tickRound` MUST execute once per wrap, never twice for one wrap

### Edge E6: Effects span multiple floors

- GIVEN positive-duration effects exist on multiple floors
- WHEN one global round advances
- THEN every effect MUST decrement once and the editor MUST NOT create or display per-floor round counters

### Edge E7: Expiry and modal freshness

- GIVEN a round tick expires an effect while the user is in a modal flow
- WHEN the effect editor is next displayed or refreshed
- THEN it MUST already show the new `expired` state and zero rounds, matching the canvas rather than a stale modal snapshot

## 9. Open assumptions

No open assumptions; locked decisions are inherited from `proposal.md`.
