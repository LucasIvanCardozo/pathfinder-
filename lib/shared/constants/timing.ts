/**
 * Application timing knobs: autosave cadence, the save round-trip ceiling, and
 * the transaction bounds that back it.
 */

/** How often `useScenarioAutosave` checks for unsaved changes and flushes them
 *  to the server. 60 s gives the GM time to make multiple paints without
 *  round-tripping each one, while still surviving a tab crash. */
export const AUTOSAVE_INTERVAL_MS = 60 * 1000;

/** Hard ceiling on a single save round-trip. If the server hasn't responded
 *  within this window the client aborts the request and shows a "Timeout"
 *  status.
 *
 *  Caveat: Next.js 16.2.x doesn't expose a `serverActions.timeout` config
 *  (verified against `node_modules/next/dist/server/config-shared.d.ts:652`
 *  — only `bodySizeLimit` and `allowedOrigins` exist). This constant is the
 *  client-side workaround. */
export const SAVE_TIMEOUT_MS = 30 * 1000;

/** How long a save transaction may run before Prisma rolls it back.
 *
 *  Prisma's default interactive-transaction timeout is 5 s, NOT 30 s — an
 *  earlier comment on `SAVE_TIMEOUT_MS` claimed otherwise and hid this bug.
 *  `applyOpsInTx` replays ops sequentially (one round-trip each), so a batch
 *  accumulated over a 60 s autosave window blows past 5 s on any remote DB and
 *  fails with `P2028: Transaction already closed`. Local dev masks it because
 *  round-trips are ~1 ms there.
 *
 *  INVARIANT: TX_TIMEOUT_MS < SAVE_TIMEOUT_MS, so the server rolls back and
 *  returns a real error before the client aborts and shows 'timeout'. */
export const TX_TIMEOUT_MS = 20 * 1000;

/** How long Prisma waits for a free pool connection before the transaction
 *  starts. Prisma's default is 2 s, which concurrent autosaves from several
 *  editor tabs can exceed on a small pool. Does not count against
 *  `TX_TIMEOUT_MS` — the transaction clock starts once the connection is
 *  acquired. */
export const TX_MAX_WAIT_MS = 5 * 1000;
