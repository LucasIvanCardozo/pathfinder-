# Server Action Pattern

Pathfinder exposes all mutations through `createAction`, a thin factory that owns schema parsing, the canonical `ActionResult` envelope, and Zod/throw normalisation.

## Decision

The factory lives at `lib/server/actions/createAction.ts`. Its exact contract is:

```ts
export type ActionResult<TData> =
  | { success: true; data: TData; error: null }
  | { success: false; data: null; error: { message: string; cause?: string } };

export function createAction<T extends z.Schema, K>(
  schema: T | null,
  callback: (context: { data: z.infer<T>; db: PrismaClient }) => Promise<K>,
): (values?: z.infer<T> | Record<string, unknown>) => Promise<ActionResult<K>>;
```

- **`schema`** — Zod schema for the input. Pass `null` for parameterless actions.
- **`callback`** — receives `{ data, db }`. `data` is already parsed (or the raw input if `schema` is null). `db` is the lazily imported Prisma client; the handler must not import `@/db` or the TARGET singleton itself. Writes accept `db`; cached reads do not (see [use-case-pattern.md](./use-case-pattern.md)).
- **Return** — an async function that callers await and inspect with `if (!result.success)`.

### Handler context

| Field | Type | Source |
|-------|------|--------|
| `data` | `z.infer<typeof schema>` | `schema.parse(values)`; raw values when `schema` is null |
| `db` | `PrismaClient` | Lazy import inside the wrapper, hot-reload-safe; passed only into write handlers |

### Optional transaction DB provider

When an action needs a transactional repository, pass `db` into the use case layer (see [use-case-pattern.md](./use-case-pattern.md)); `createAction` itself does not own the transaction. A future variant may accept a `dbProvider` for use cases that pre-open a transaction; today, run the transaction inside the handler.

## ActionResult envelope (canonical)

Every new Server Action returns `ActionResult<T>`. This is the exact Carta QR target and the only shape callers will see — there is no narrow-union fallback:

```ts
type ActionResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { message: string; cause?: string } };
```

- **`success: true` branches** — `data` is whatever the callback returned; `error` is `null`.
- **`success: false` branches** — `data` is `null`; `error.message` is a single string the wrapper formats; `error.cause` is an optional string (a human-readable cause description), **not** an `Error` object.
- **No `fieldErrors` field.** The wrapper never produces one. UI code parses `path 🡆 message` lines from `error.message` to map per-field errors.

## Zod formatting

Carta QR's exact `createAction` runs `schema.parse(values)` (not `safeParse`) and catches the thrown `ZodError`; on failure it joins every issue into `error.message` as `path 🡆 message` separated by newlines so the caller gets one combined message. **Never return only `issues[0]`.** Surface every issue with `path` so the UI can show per-field errors. The wrapper is the only place that does this formatting; handlers do not construct the envelope or shape Zod output, and do not return nested `{success: false, error: ...}` envelopes of their own — the wrapper catches and normalises thrown safe domain errors into the canonical `ActionResult`.

## Generic error handling

`createAction` catches unknown throws, logs them with `console.error('[createAction] Unhandled error:', error)`, and returns a capitalised `error.message` plus optional `error.cause` (an optional string, **not** an `Error` object). Handlers must not catch their own errors and must not return `{success: false}` envelopes. For **known domain/action failures**, the handler (or the use case it calls) **throws a safe error** — `throw new Error('Pieza inválida: foo')` — and the wrapper normalises it into `{success: false, data: null, error: {message, cause}}`.

**Framework control flow vs custom auth errors.** Only Next.js framework control-flow signals stay unwrapped: `redirect()` and `notFound()` throw framework signals (`NEXT_REDIRECT`, `NEXT_NOT_FOUND`) that `createAction`'s try/catch must not capture, so actions that issue them stay outside `createAction` and return `Promise<never>`. The future `createProtectedAction` defines its own **custom auth errors** (its own `unauthorized` / `forbidden` failures, not Next.js framework APIs) — those are caught and normalised by its `createAction` wrapper exactly like any other safe domain error. They are **not** framework control-flow exceptions.

## Quick path (add an action)

1. `'use server'` at the top of `*.action.ts`. The file lives at TARGET `lib/server/actions/<entity>.action.ts`; the CURRENT `src/app/actions/` is migration debt, not a place for new work.
2. `import createAction from '@/lib/server/actions/createAction'`.
3. Use the injected `db` from the handler context — never `import { db } from '@/db'` at the top of an action file.
4. Call one use case; do not put business logic in the handler body. Throw safe errors for known failures.

```ts
// lib/server/actions/scenario.action.ts
'use server';

import createAction from '@/lib/server/actions/createAction';
import { ScenarioInputSchema } from '@/lib/shared/schemas/scenario.schemas';
import { scenarioUseCases } from '@/lib/server/useCases/scenario.usecases';

export const saveScenario = createAction(ScenarioInputSchema, async ({ data, db }) =>
  scenarioUseCases.save(db, data),
);
```

## Anti-patterns

- Throwing a `ZodError` from inside a handler. The wrapper already handles it.
- Calling `prisma.*` directly from an action file when a use case exists for that entity.
- Wrapping `redirect()` inside `createAction`. `redirect()` throws `NEXT_REDIRECT`; the wrapper would convert it to a `{success: false}` result. Redirecting actions stay **unwrapped** and return `Promise<never>`. This is the documented exception.
- Importing `@/db` (CURRENT) or `@/lib/server/db/db` (TARGET) at module top-level inside an action file. The wrapper injects `db` lazily so hot reload does not leak clients; cached reads import the singleton inside their own module instead.
- Returning a custom error shape (`{ ok, error }`, `{ error: { code, message } }`) or a hand-rolled `{success: false, ...}` outside the canonical `ActionResult` envelope. The wrapper owns envelope construction.
- Catching thrown errors inside the handler and swallowing them. Let the wrapper normalise safe errors.

## createProtectedAction (future, auth-dependent)

`createProtectedAction` lives at `lib/server/createProtectedAction.ts` and is the auth-extended wrapper. Pathfinder has no authentication today, so it is **out of scope until an auth provider is added**. When it ships, it will receive `{ data, db }` from `createAction`, inject `{ session, roleNames, effectiveRole, venueId }` after auth checks, and call the handler. Its future custom `unauthorized` / `forbidden` auth errors are Carta's **custom auth errors**, not Next.js framework control-flow signals: they are caught and normalised by the inner `createAction` wrapper into the canonical `{success: false, data: null, error: ...}` envelope, the same as any safe domain error.

### Rate limiting is manual

`createAction` does **not** apply automatic rate limiting. Rate limits, when needed, are an opt-in inside the handler (e.g. an in-memory token bucket keyed by IP or session). Do not assume `createAction` or any future `createProtectedAction` will throttle for you.

## CURRENT vs TARGET

The CURRENT action surface lives at `src/app/actions/`:

| CURRENT file | Notes | TARGET file |
|--------------|-------|-------------|
| `src/app/actions/scenarios.ts` | Direct Prisma + mixed contracts. Migration debt. | `lib/server/actions/scenario.action.ts` |
| `src/app/actions/subdivisions.ts` | Mixed narrow-union results, `ensureDefaultSubdivisions` mutates on read. | `lib/server/actions/subdivision.action.ts` + the read-mutation caveat in [cache-tag-convention.md](./cache-tag-convention.md) |
| `src/app/actions/scenarios.ts::createBlankScenario` | `redirect()` wrapped in an action that returns `Promise<never>`. | Stays unwrapped when migrated; documented exception above. |

`createAction` itself is not yet implemented. Today's actions are hand-rolled; the wrapper is the migration target. Existing actions in `src/app/actions/` are migration debt; **new work goes to TARGET `lib/server/actions/`** (the transitional `src/app/actions/` is not a place for new code). All new hand-rolled actions must use the canonical `ActionResult` envelope above and throw safe errors instead of returning `{success: false}`.

## Related

- [use-case-pattern.md](./use-case-pattern.md) — what runs inside the handler.
- [error-handling.md](./error-handling.md) — `ActionResult` semantics, control-flow exceptions.
- [entity-file-pattern.md](./entity-file-pattern.md) — file naming.
- Next.js: [Server Actions and Mutations](https://nextjs.org/docs/app/getting-started/updating-data).