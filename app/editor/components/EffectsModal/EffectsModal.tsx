'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHatWizard, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { Modal } from '@/components/Modal';
import { EffectMarkerRow } from '@/canvas/components/EffectMarkerRow';
import { EFFECT_PALETTE, defaultLengthFtFor } from '@/lib/shared/constants';
import { EffectFormSchema } from '@/lib/shared/schemas/effect.schemas';
import type { EffectInput, EffectKind, ScenarioEffect } from '@/lib/shared/types';
import styles from './EffectsModal.module.css';

/**
 * Props for the `EffectsModal`. The modal is now a controlled react-hook-form
 * root: `defaultValues` is the full `EffectInput` the hook pre-built (id,
 * floorId, timestamps included); `onSubmit` receives the validated form data
 * and the hook routes it to the right op. The modal never reads or writes the
 * draft directly — that lives in `useEffectsModal`.
 */
export type EffectsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Effect list for the active floor (the modal shows only the active floor's
   *  effects to keep the list focused). */
  effects: readonly ScenarioEffect[];
  /** Full `EffectInput` for the form. `null` when the modal has nothing to
   *  edit (user has not selected or created anything). */
  defaultValues: EffectInput | null;
  /** True when the modal is editing an existing effect (label-only edit in
   *  PR 2). */
  isEditing: boolean;
  onCreateNew: () => void;
  onSelect: (effectId: string) => void;
  /** Validated form data — the hook's `submit` decides whether to dispatch
   *  `addEffect` or `relabelEffect`. The modal does NOT close itself on
   *  success; the hook owns the open/close state. */
  onSubmit: (data: EffectInput) => void;
  /** PR 2: per-row Dismiss action (visual-only state). Wired to the
   *  marker column in the list pane. */
  onDismiss: (effectId: string) => void;
  /** PR 2: per-row Remove action (hard delete via `removeEffect`). */
  onRemove: (effectId: string) => void;
};

/**
 * Form state for the kind radio. Keeps the radio group controlled even when
 * the parent component re-renders with the same draft.
 */
const KIND_OPTIONS: { value: EffectKind; label: string }[] = [
  { value: 'burst', label: 'Burst' },
  { value: 'cone', label: 'Cono' },
  { value: 'line', label: 'Línea' },
  { value: 'wall', label: 'Muro' },
];

const DURATION_OPTIONS: { value: EffectInput['durationKind']; label: string }[] = [
  { value: 'rounds', label: 'Rondas' },
  { value: 'rounds-concentration', label: 'Rondas (concentración)' },
  { value: 'minutes', label: 'Minutos' },
  { value: 'concentration', label: 'Concentración' },
];

/**
 * Layout: list (left) + editor (right). Mirrors the ShortcutsModal's two-pane
 * pattern. The list renders one row per effect on the active floor; the editor
 * shows the form fields. Both panes scroll independently when the modal grows.
 */
export function EffectsModal({
  isOpen,
  onClose,
  effects,
  defaultValues,
  isEditing,
  onCreateNew,
  onSelect,
  onSubmit,
  onDismiss,
  onRemove,
}: EffectsModalProps) {
  // Local swap between "list" and "editor" panes on small screens. Default
  // is "list" when the modal opens on a new effect and "editor" when it's
  // editing an existing one.
  const [view, setView] = useState<'list' | 'editor'>(isEditing ? 'editor' : 'list');

  useEffect(() => {
    if (isOpen) setView(isEditing ? 'editor' : 'list');
  }, [isOpen, isEditing]);

  return (
    <Modal isOpen={isOpen} title="Efectos" onClose={onClose}>
      <div className={styles.shell}>
        <aside className={styles.listPane} data-view={view}>
          <header className={styles.listHeader}>
            <h3>Marcadores</h3>
            <button
              type="button"
              className={styles.newBtn}
              onClick={() => {
                onCreateNew();
                setView('editor');
              }}
              aria-label="Nuevo marcador"
            >
              <FontAwesomeIcon icon={faPlus} /> Nuevo
            </button>
          </header>
          <ul className={styles.list}>
            {effects.length === 0 ? (
              <li className={styles.empty}>No hay marcadores en este piso.</li>
            ) : (
              effects.map((effect) => (
                <li key={effect.id} className={styles.rowWrap}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() => {
                      onSelect(effect.id);
                      setView('editor');
                    }}
                  >
                    <EffectMarkerRow
                      color={effect.color}
                      label={effect.label}
                      variant="list"
                      trailing={
                        <span className={styles.rowMeta}>
                          {effect.kind} · {effect.remainingRounds}r
                        </span>
                      }
                    />
                  </button>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.rowAction}
                      onClick={() => onDismiss(effect.id)}
                      title="Dismiss (visual-only)"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      className={`${styles.rowAction} ${styles.rowDanger}`}
                      onClick={() => onRemove(effect.id)}
                      title="Dispel Magic (remove)"
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className={styles.editorPane} data-view={view}>
          {defaultValues ? (
            <EffectsForm
              key={defaultValues.id}
              defaultValues={defaultValues}
              isEditing={isEditing}
              onSubmit={onSubmit}
              onClose={onClose}
            />
          ) : (
            <p className={styles.empty}>Seleccioná un marcador para editar.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

/**
 * Inner form component. Mounted fresh whenever the editing id changes (the
 * `key` on the parent) so the `useForm` defaults hydrate from the new row
 * and any in-flight edits are discarded.
 */
function EffectsForm({
  defaultValues,
  isEditing,
  onSubmit,
  onClose,
}: {
  defaultValues: EffectInput;
  isEditing: boolean;
  onSubmit: (data: EffectInput) => void;
  onClose: () => void;
}) {
  const methods = useForm<EffectInput>({
    resolver: zodResolver(EffectFormSchema),
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = methods;

  // Narrow subscription for the `kind` field — drives the `rotationDeg`
  // disabled state without re-rendering the whole form on every keystroke.
  const kind = useWatch({ control, name: 'kind' });

  return (
    <FormProvider {...methods}>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        <header className={styles.editorHeader}>
          <FontAwesomeIcon icon={faHatWizard} />
          <h3>{isEditing ? 'Editar marcador' : 'Nuevo marcador'}</h3>
        </header>

        <label className={styles.field}>
          <span>Etiqueta</span>
          <input
            type="text"
            maxLength={120}
            placeholder="Ej. Bola de fuego"
            {...register('label')}
          />
          {errors.label ? <span className={styles.error}>{errors.label.message}</span> : null}
        </label>

        <fieldset className={styles.field}>
          <legend>Forma</legend>
          <div className={styles.kindGroup}>
            <Controller
              name="kind"
              control={control}
              render={({ field }) => (
                <>
                  {KIND_OPTIONS.map((opt) => (
                    <label key={opt.value} className={styles.kindOption}>
                      <input
                        type="radio"
                        name="effect-kind"
                        value={opt.value}
                        checked={field.value === opt.value}
                        onChange={() => {
                          const palette = EFFECT_PALETTE[opt.value];
                          // Cross-field update: changing the kind also resets
                          // the colour and the dimensions to the palette's
                          // defaults. `setValue` with `shouldDirty: true`
                          // keeps the dirty flag in sync so the autosave
                          // treats the new effect as a real edit.
                          field.onChange(opt.value);
                          setValue('color', palette.color, { shouldDirty: true });
                          setValue('widthFt', palette.defaultWidthFt, { shouldDirty: true });
                          setValue(
                            'depthFt',
                            opt.value === 'cone' || opt.value === 'line' || opt.value === 'wall'
                              ? defaultLengthFtFor(opt.value)
                              : palette.defaultDepthFt,
                            { shouldDirty: true },
                          );
                        }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </>
              )}
            />
          </div>
          {errors.kind ? <span className={styles.error}>{errors.kind.message}</span> : null}
        </fieldset>

        <div className={styles.row2}>
          <label className={styles.field}>
            <span>Ancla X (celda)</span>
            <input
              type="number"
              step={1}
              {...register('originCellX', { valueAsNumber: true })}
            />
            {errors.originCellX ? (
              <span className={styles.error}>{errors.originCellX.message}</span>
            ) : null}
          </label>
          <label className={styles.field}>
            <span>Ancla Y (celda)</span>
            <input
              type="number"
              step={1}
              {...register('originCellY', { valueAsNumber: true })}
            />
            {errors.originCellY ? (
              <span className={styles.error}>{errors.originCellY.message}</span>
            ) : null}
          </label>
        </div>

        <div className={styles.row2}>
          <label className={styles.field}>
            <span>Ancho (ft)</span>
            <input
              type="number"
              step={0.5}
              min={0}
              {...register('widthFt', { valueAsNumber: true })}
            />
            {errors.widthFt ? <span className={styles.error}>{errors.widthFt.message}</span> : null}
          </label>
          <label className={styles.field}>
            <span>Largo (ft)</span>
            <input
              type="number"
              step={0.5}
              min={0}
              {...register('depthFt', { valueAsNumber: true })}
            />
            {errors.depthFt ? <span className={styles.error}>{errors.depthFt.message}</span> : null}
          </label>
        </div>

        <label className={styles.field}>
          <span>Rotación (°)</span>
          <input
            type="number"
            step={5}
            disabled={kind === 'burst'}
            {...register('rotationDeg', { valueAsNumber: true })}
          />
          {errors.rotationDeg ? (
            <span className={styles.error}>{errors.rotationDeg.message}</span>
          ) : null}
        </label>

        <label className={styles.field}>
          <span>Color</span>
          <input type="color" {...register('color')} />
          {errors.color ? <span className={styles.error}>{errors.color.message}</span> : null}
        </label>

        <fieldset className={styles.field}>
          <legend>Duración</legend>
          <div className={styles.kindGroup}>
            {DURATION_OPTIONS.map((opt) => (
              <label key={opt.value} className={styles.kindOption}>
                <input
                  type="radio"
                  value={opt.value}
                  {...register('durationKind')}
                  defaultChecked={defaultValues.durationKind === opt.value}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {errors.durationKind ? (
            <span className={styles.error}>{errors.durationKind.message}</span>
          ) : null}
        </fieldset>

        <label className={styles.field}>
          <span>Rondas restantes</span>
          <input
            type="number"
            step={1}
            min={0}
            {...register('remainingRounds', { valueAsNumber: true })}
          />
          {errors.remainingRounds ? (
            <span className={styles.error}>{errors.remainingRounds.message}</span>
          ) : null}
        </label>

        <footer className={styles.footer}>
          {isEditing ? (
            <button type="button" className={styles.dangerBtn} onClick={onClose}>
              <FontAwesomeIcon icon={faTimes} /> Cerrar
            </button>
          ) : null}
          <button type="submit" className={styles.primaryBtn}>
            {isEditing ? 'Guardar etiqueta' : 'Crear marcador'}
          </button>
        </footer>
      </form>
    </FormProvider>
  );
}
