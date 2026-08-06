/**
 * Application timing knobs (autosave, anything else that fires on a wall-clock
 * schedule outside of the dev/perf subsystem).
 *
 * Dev/perf instrumentation intervals live in `lib/shared/constants/perf.ts`
 * so the perf layer is self-contained.
 */

/** How often `useScenarioAutosave` checks for unsaved changes and flushes them
 *  to the server. 60 s gives the GM time to make multiple paints without
 *  round-tripping each one, while still surviving a tab crash. */
export const AUTOSAVE_INTERVAL_MS = 60 * 1000;

/** Hard ceiling on a single save round-trip. If the server hasn't responded
 *  within this window the client aborts the request and shows a "Timeout"
 *  status. 30 s matches Prisma's default transaction timeout so we surface
 *  the same failure mode the user would otherwise see as a hung request.
 *
 *  Caveat: Next.js 16.2.x doesn't expose a `serverActions.timeout` config
 *  (verified against `node_modules/next/dist/server/config-shared.d.ts:652`
 *  — only `bodySizeLimit` and `allowedOrigins` exist). This constant is the
 *  client-side workaround; bump it if your DB transactions legitimately take
 *  longer than 30 s, or look at diff-based autosaves (memory observation
 *  "pathfinder-diff-based-autosave") to shrink the payload. */
export const SAVE_TIMEOUT_MS = 30 * 1000;
