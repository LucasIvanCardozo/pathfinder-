// Effect Server Actions. Stub for the entity-file pattern.
//
// Every effect mutation flows through `ScenarioOp` today (the autosave replay
// in `saveScenarioOps` owns the single mutation channel). There is no
// top-level action like `castSpellAction` or `purgeOrphansAction` yet because
// adding one would split the same row across two TXs — the op buffer exists
// precisely to keep every scenario mutation in one transaction.
//
// The file exists so:
//   - The five-file split (schemas | types | repository | usecases | action)
//     is preserved for the entity.
//   - The future home of any independent write action is obvious.
//
// When a write action lands here (e.g. an admin tool that needs to expire
// spells without a combat op), use `createAction` per the server-action
// pattern and call `effectUseCases` (which in turn calls `effectRepository`).
// `'use server'` at the top, per the canonical Server Action file shape.