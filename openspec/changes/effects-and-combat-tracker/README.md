# Effects and Combat Tracker

This chained change adds persistent area-of-effect markers and a combat tracker to Pathfinder. It is intentionally scaffolded only: the proposal, specification, design, and task files are empty for the next SDD phase.

## PR roadmap

The change is force-chained into four reviewable pull requests, with a maximum target of 600 changed lines per PR:

| PR | Scope | Review focus |
|---|---|---|
| 1 | Persistence and minimal render | Add `ScenarioEffect` persistence and operations, then render persistent effects with an effects `Konva.Layer` placed before `cellsBySub.map(...)`. No catalog is introduced. |
| 2 | Editor modal, walls, and overlap | Let the GM create effects from an editor modal; add wall behavior and overlap handling while preserving obscured-darkness stacking above markers. |
| 3 | Combat tracker | Add `Combat` and `Combatant`, plus the persistent Round Viewer footer and save-then-purge cascade deletion when combat ends. |
| 4 | Polish | Finish interaction, keyboard shortcuts, visual details, and cleanup across the first three slices. |

## Guardrails

- Follow the Server Action (`createAction`) → Use Case → Repository → Prisma boundary.
- Use `updateTag` and `revalidatePath` for writes; do not use `revalidateTag` in actions.
- Centralize IDs in `lib/shared/utils/generateId.ts`, extending it with `newId('effect')` when required.
- Read the runtime constants in `lib/shared/constants/timing.ts`, `subdivisions.ts`, and `keyboard.ts` before changing them.
- Add new shortcuts in `lib/shared/constants/shortcuts.ts` under the new `combat` category.
- Keep CSS Modules as the only styling approach.
- Do not add a catalog for effects; the GM creates them through the editor modal.
- Do not claim test coverage: Pathfinder has no configured test runner. Use only the commands listed in `openspec/config.yaml` and `AGENTS.md`.

## SDD files

- [`proposal.md`](./proposal.md) — change intent and scope; to be completed next.
- [`spec.md`](./spec.md) — behavioral requirements; to be completed next.
- [`design.md`](./design.md) — implementation design; to be completed next.
- [`tasks.md`](./tasks.md) — four-PR task breakdown; to be completed next.
