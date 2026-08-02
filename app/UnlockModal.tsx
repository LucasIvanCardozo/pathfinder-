'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTransition } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import controlStyles from '@/components/form/control.module.css';
import { FormField } from '@/components/form/FormField';
import { unlockEditor } from '@/lib/server/actions/auth.action';
import styles from './_components/unlock-modal.module.css';

/** Schema for the password prompt. Module-scope so the resolver is cached. */
const UnlockSchema = z.object({
  password: z.string().min(1, 'Ingresá la contraseña'),
});

type UnlockInput = z.infer<typeof UnlockSchema>;

type Props = {
  onSuccess: () => void;
  onCancel: () => void;
};

/**
 * Password prompt for the editor soft gate. Wraps the generic `Modal` and
 * submits through the `unlockEditor` server action. On success the parent
 * replays the stashed navigation; on failure the error is shown in a
 * banner and as the root form error.
 */
export function UnlockModal({ onSuccess, onCancel }: Props) {
  const [isPending, startTransition] = useTransition();

  const methods = useForm<UnlockInput>({
    resolver: zodResolver(UnlockSchema),
    defaultValues: { password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });

  const onSubmit = methods.handleSubmit((values) => {
    startTransition(async () => {
      const result = await unlockEditor(values);
      if (result.success) {
        onSuccess();
        return;
      }
      methods.setError('root', { message: result.error.message });
    });
  });

  return (
    <Modal isOpen onClose={onCancel} title="Acceso al editor">
      <FormProvider {...methods}>
        <form onSubmit={onSubmit} className={styles.form}>
          <FormField
            label="Contraseña"
            error={methods.formState.errors.password?.message}
            htmlFor="password"
            required
          >
            <PasswordInput />
          </FormField>
          {methods.formState.errors.root?.message ? (
            <p className={styles.error} role="alert">
              {methods.formState.errors.root.message}
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button type="button" onClick={onCancel} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Verificando…' : 'Entrar'}
            </Button>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
}

/**
 * Password input registered through `useFormContext`. Mirrors the visual
 * shape of `FormInput` but uses `type="password"` (which the shared
 * primitive does not expose).
 */
function PasswordInput() {
  const { register } = useFormContext<UnlockInput>();
  return (
    <input
      id="password"
      type="password"
      className={controlStyles.control}
      placeholder="••••••"
      autoComplete="current-password"
      {...register('password')}
    />
  );
}
