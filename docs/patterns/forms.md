# Forms

Forms are built with react-hook-form + `@hookform/resolvers/zod` + Zod schemas. One `useForm` at the root, primitives consume context, narrow subscriptions for performance.

## Decision

- One `useForm` per form, at the form's root component.
- Resolver is the entity's Zod schema (TARGET: `lib/shared/schemas/<entity>.schemas.ts`). Keep schemas at module scope so the resolver is cached.
- `defaultValues` is required and complete. Async defaults come from server-loaded props.
- Wrap composed forms in `FormProvider`. Primitives consume `useFormContext` — they never call `useForm`.
- Server submissions go through Server Actions returning the canonical `ActionResult`. Map `result.error.message` to a banner and parse the `path 🡆 message` lines for per-field errors. The envelope has **no `fieldErrors` field** — the wrapper formats every Zod issue into `error.message` and the form code reverses the format locally.

## Quick path

```tsx
'use client';

import { useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SubdivisionConfigSchema } from '@/lib/shared/schemas/subdivision.schemas';
import { FormField, FormInput, FormNumberInput } from '@/components/UI/Form*';
import { saveSubdivisionAction } from '@/lib/server/actions/subdivision.action';

export function SubdivisionForm({ defaultValues }: { defaultValues: SubdivisionInput }) {
  const [isPending, startTransition] = useTransition();

  const methods = useForm<SubdivisionInput>({
    resolver: zodResolver(SubdivisionConfigSchema.omit({ id: true })),
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });

  const onSubmit = methods.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveSubdivisionAction(values);
      if (!result.success) {
        methods.setError('root', { message: result.error.message });
        // error.message carries "path 🡆 message" lines; map them per field:
        for (const [name, message] of parseFieldErrors(result.error.message)) {
          methods.setError(name, { message });
        }
        return;
      }
      methods.reset(values);
    });
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit}>
        <FormField label="Nombre" error={methods.formState.errors.name?.message}>
          <FormInput name="name" />
        </FormField>
        <FormField label="Ratio" error={methods.formState.errors.cellSizeRatio?.message}>
          <FormNumberInput name="cellSizeRatio" min={1} max={64} />
        </FormField>
        <button type="submit" disabled={isPending}>Guardar</button>
      </form>
    </FormProvider>
  );
}
```

`parseFieldErrors(message)` splits on newlines, takes the part before each `🡆` as the field name, and returns `[name, message]` tuples. Any line without `🡆` falls back to the banner; see [error-handling.md](../architecture/error-handling.md) for the canonical envelope and the exact format.

## Rules

| Rule | Why |
|------|-----|
| One `useForm` per form root | Keeps state coherent and avoids double registration. |
| `mode: 'onSubmit'`, `reValidateMode: 'onBlur'` | Cheapest valid configuration for most forms. |
| Complete `defaultValues` | Avoids `undefined`-vs-missing surprises during dirty checks. |
| `useWatch({ control, name })` for narrow reads | Avoids whole-form re-renders. |
| `getValues()` for one-shot reads in handlers | Cheaper than `watch()` during render. |
| `Controller` for non-native widgets | Anything that does not accept `ref`/spread must use `Controller`. |
| Primitives use `useFormContext`, never `useForm` | Keeps the provider as the single source of truth. |
| Schemas at module scope | Resolver caches the schema. Inline `z.object` re-evaluates on every render. |
| `field.id` as key for `useFieldArray` | Stable across reorders. |

## Primitives

The CURRENT primitives live in `src/app/components/form/`:

- `FormField` — label + error + hint wrapper. Consumes nothing from the form context; render-prop driven.
- `FormInput` — text/number input bound to `useFormContext().register(name)`.
- `FormNumberInput` — same as `FormInput` but typed for integers.
- `FormSelect` — `<select>` with options.
- `FormSlider` — range slider.

TARGET location: `components/UI/FormField/`, `components/UI/FormInput/`, etc. Primitives only render markup; they do not validate or transform.

## Narrow subscription example

```tsx
import { useWatch, useFormContext } from 'react-hook-form';

function CellSizeHint() {
  const { control } = useFormContext<SubdivisionInput>();
  const ratio = useWatch({ control, name: 'cellSizeRatio' });
  return <p>Cells render at {64 / Math.max(1, ratio)}px.</p>;
}
```

`useWatch` only re-renders this component when `cellSizeRatio` changes — not when other fields update.

## Anti-patterns

- `const methods = useForm(); const piece = watch('pieceIds');` in a render that only needs `pieceIds`. Use `useWatch({ control, name: 'pieceIds' })`.
- Calling `useForm()` inside a field component. Always go through `FormProvider`.
- Defining `z.object({...})` inside the component body. Hoist to module scope.
- `defaultValues: {}` because the schema has defaults. Always provide the full shape explicitly.
- Setting `mode: 'onChange'` for large forms. Use `onBlur` for post-submit validation.
- Using `useEffect` to react to form state. Subscribe with `useWatch` or read in the handler.
- Showing the toast for `success` after every save. Reserve toasts for destructive or important actions.

## CURRENT vs TARGET

The CURRENT form primitives and consumers are:

| CURRENT | TARGET |
|---------|--------|
| `src/app/components/form/Form{Field,Input,NumberInput,Select,Slider}.tsx` | `components/UI/Form{Field,Input,NumberInput,Select,Slider}/` |
| `src/app/components/SubdivisionManager.tsx` (whole-form `methods.watch` + inline `watch("pieceIds")`) | `components/Features/SubdivisionManager/SubdivisionManager.tsx` using `useWatch` |
| `src/canvas/weather/WeatherPanel.tsx` (whole-form `methods.watch`) | Use `useWatch({ control, name })` per consumer |

The CURRENT stack already uses react-hook-form + Zod. The migration is folder-only; behaviour rules above are unchanged.

## Related

- [server-action-pattern.md](../architecture/server-action-pattern.md) — the action that `onSubmit` calls.
- [code-style.md](./code-style.md) — Biome + naming.
- [error-handling.md](../architecture/error-handling.md) — `ActionResult` envelope and the `path 🡆 message` format.
- react-hook-form: [useForm](https://react-hook-form.com/docs/useform), [useWatch](https://react-hook-form.com/docs/usewatch).