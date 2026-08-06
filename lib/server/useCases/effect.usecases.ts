/**
 * Effect use cases. Stub for the entity-file pattern.
 *
 * Effect mutations today flow through `ScenarioOp` (`addEffect`, `removeEffect`)
 * and are replayed inside `scenarioRepository.applyOpsInTx` — there is no
 * independent write use case yet because the autosave pipeline owns every
 * mutation channel and adding a parallel write path would split the same row
 * across two TXs.
 *
 * Read use cases (e.g. `listByScenario`) are not needed: `ScenarioEffect` rows
 * travel back to the editor inside `findByIdWithFloors` (the same payload
 * the `FloorStack` paints and the tooltip inspects). Splitting them out would
 * force a second round-trip per page load for zero UX gain.
 *
 * This file stays so:
 *   - The entity-file pattern (`schemas | types | repository | usecases |
 *     action`) is intact across the codebase.
 *   - When a future write use case lands — e.g. an admin tool that needs to
 *     expire spells without a combat op — the home is obvious.
 *
 * Add new methods here, not in `scenario.usecases.ts`. The repository for
 * this entity is `effectRepository` and accepts an injected `db`/`tx` so a
 * cached read (none today) would import the server singleton inside this
 * module the same way `scenarioUseCases.list` does.
 */
export const effectUseCases = {} as const;
