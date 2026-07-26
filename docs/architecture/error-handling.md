# Error Handling

Pathfinder normalises every mutation through the canonical `ActionResult` discriminated union and reserves exceptions for framework control flow.

## Decision

The canonical envelope is exactly Carta QR's shape — there is no narrow-union fallback:

```ts
type ActionResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { message: string; cause?: string } };
```

- **Expected validation failures** are formatted by `createAction` itself: every Zod issue becomes a `path 🡆 message` line and all lines are joined into `error.message`. The wrapper never returns a `fieldErrors` object; UI parses the `path 🡆 message` lines.
- **Known domain/action failures** are **thrown as safe errors** from inside a use case or handler (`throw new Error('Pieza inválida: foo')`). The wrapper catches them, logs them with the `[createAction] Unhandled error:` prefix when they look unexpected, and returns `{ success: false, data: null, error: { message, cause? } }` with a capitalised `message`. `cause` is an optional string (a human-readable cause description), **not** an `Error` object.
- **Framework control flow** (`redirect()`, `notFound()` — Next.js framework APIs) is allowed to throw. The wrapper does not catch it. Actions that issue these signals stay outside `createAction` and return `Promise<never>`. (If Next.js framework `forbidden()` / `unauthorized()` APIs are called directly as Next APIs they behave the same way. Carta QR's future `createProtectedAction` defines its own **custom auth errors** — those are normalised by its `createAction` wrapper exactly like any safe domain error and are **not** framework control-flow exceptions.)
- **Infrastructure failures** (DB down, schema drift) are caught by `createAction`'s generic handler, logged with `console.error`, and returned as `{ success: false, data: null, error: { message: <capitalised>, cause } }`. `cause` here is an optional string, **not** an `Error` object.
- **`error.tsx` / `global-error.tsx` / `not-found.tsx`** catch render-time exceptions on the Server Component tree.

## Rules

| Rule | Why |
|------|-----|
| Surface every Zod issue, not just `issues[0]` | Per-field errors improve the form UX; the wrapper joins them into `error.message`. |
| Throw safe errors for known domain/action failures | The wrapper normalises them; handlers stay free of try/catch boilerplate. |
| Handlers must not construct `ActionResult` envelopes | The wrapper owns envelope construction; handlers return the domain value or throw. |
| Do not catch `redirect()`/`notFound()` | Framework signal must propagate to the runtime. |
| Log infrastructure errors with context | `[createAction] Unhandled error:` prefix so they are greppable. |
| Capitalise user-facing error messages | Convention from `createAction`. |
| Never expose stack traces in `ActionResult.error.message` | They go to logs only. |

## Quick path (Server Action)

```ts
export const updateSubdivision = createAction(
  SubdivisionConfigPieceIdsInputSchema,
  async ({ data, db }) => {
    const validIds = new Set(ALL_PIECES.map((p) => p.id));
    for (const id of data.pieceIds) {
      if (!validIds.has(id)) {
        throw new Error(`Pieza inválida: ${id}`);
      }
    }
    return subdivisionUseCases.update(db, data);
  },
);
```

Inside a wrapped action, **return the domain value** (the wrapper wraps it as `{success: true, data}`) or **throw a safe error** (the wrapper normalises it into `{success: false, data: null, error: {message, cause?}}`). Do not construct the envelope manually.

## Redirect exception

`createBlankScenario` (CURRENT: `src/app/actions/scenarios.ts`) calls `redirect()`. Such actions stay **unwrapped** because `createAction`'s try/catch would convert `NEXT_REDIRECT` into `{success: false}`. The action returns `Promise<never>` to signal the framework owns the response.

```ts
export async function createBlankScenario(): Promise<never> {
  // ... create the scenario ...
  redirect(`/editor?id=${scenarioId}`);
}
```

## Page-level errors

- `app/error.tsx` — catches render-time exceptions for the matching segment. Must be a Client Component.
- `app/global-error.tsx` — last-resort handler for the root layout. Renders its own `<html>`.
- `app/not-found.tsx` — for `notFound()` calls and 404 responses.

```tsx
'use client';

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1>Algo falló</h1>
      <button type="button" onClick={reset}>Reintentar</button>
    </main>
  );
}
```

## Form integration

Server Action results flow back through `useTransition`. Map `result.error.message` to a banner and parse the `path 🡆 message` lines for per-field errors:

```tsx
const [isPending, startTransition] = useTransition();

function onSubmit(values: FormValues) {
  startTransition(async () => {
    const result = await saveScenarioAction(values);
    if (!result.success) {
      setBannerError(result.error.message);
      setFieldErrors(parseFieldErrors(result.error.message));
      return;
    }
    setBannerError(null);
    setFieldErrors({});
  });
}
```

The helper splits `error.message` on newlines, takes the part before each `🡆` as the field name and the part after as the message, and returns a `Record<string, string[]>`; treat the banner as fallback when no `🡆` line matches a known field.

## Logging

- `console.error('[createAction] Unhandled error:', error)` for caught infrastructure failures.
- `console.error('[createProtectedAction] auth() failed:', err)` (future) for auth bootstrap failures.
- Never `console.log` validation failures. They are expected.
- Never `console.log` Prisma's `P2002`/`P2025` as a warning; convert to a structured `ActionResult` first.

## Anti-patterns

- Constructing an `ActionResult` envelope inside a handler (`return {success: false, error}`). Return the domain value or throw a safe error; the wrapper builds the envelope.
- Throwing `new Error('Invalid input')` from inside a repository when the failure is expected. Repositories return `null`; use cases decide what `null` means.
- Wrapping a `redirect()`-issuing action in `createAction`. Redirects become broken `{success: false}` responses.
- Returning `null` on validation failure instead of throwing or letting the wrapper normalise. Callers cannot distinguish "empty" from "failed".
- Swallowing `notFound()` or `redirect()` with a `try { ... } catch { return null }` block.
- Catching the `ActionResult` envelope and re-throwing it to bubble up the stack.
- Returning a generic `{ ok: true }` shape that diverges from the rest of the app. Stick to `ActionResult`.
- Reading `result.fieldErrors` in client code — the field does not exist on the canonical envelope. Parse `result.error.message` instead.

## CURRENT vs TARGET

The CURRENT action surface returns either `Promise<T>` (success), a narrow `{success, error}` union, or `Promise<void>`. Migration converges them on the canonical `ActionResult<T>` above; handlers stop building the envelope by hand and start throwing safe errors instead.

| CURRENT pattern | TARGET replacement |
|-----------------|-------------------|
| `saveScenario` throws `new Error(validated.error.issues[0]?.message ?? "Datos inválidos")` | `createAction` formats all issues into `error.message`; the throw is removed. |
| `createSubdivision` returns `{success: false, error: '...'}` | Use case throws a safe error; action wrapper centralises Zod formatting. |
| `deleteSubdivision` returns `{success: false, error: '...'}` on business failure | Use case throws a safe error; action wrapper is unchanged. |
| `createBlankScenario` calls `redirect()` | Stays unwrapped; documented exception. |
| `app/` has no `error.tsx` | Add `app/error.tsx` + `app/not-found.tsx` during the migration. |

## Related

- [server-action-pattern.md](./server-action-pattern.md) — wrapper owns Zod formatting.
- [data-fetching.md](./data-fetching.md) — actions inside data flow.
- Next.js: [`error.tsx`](https://nextjs.org/docs/app/api-reference/file-conventions/error), [`redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect).