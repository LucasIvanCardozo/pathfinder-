'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { z } from 'zod';
import type { SubdivisionConfig } from '@/lib/shared/types';
import { SubdivisionConfigInputSchema } from '@/lib/shared/schemas';
import {
  createSubdivision,
  deleteSubdivision,
  updateSubdivision,
} from '@/lib/server/actions/subdivision.action';
import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { FormField, FormInput, FormNumberInput } from '@/components/form';
import { Modal } from '@/components/Modal';
import styles from './subdivision-manager.module.css';

const FormSchema = SubdivisionConfigInputSchema;
type FormValues = z.infer<typeof FormSchema>;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Source-of-truth subdivisions owned by the parent. The modal treats them
   * as an initial snapshot and maintains its own local copy while open so
   * create/update/delete can reflect immediately without round-tripping. */
  subdivisions: SubdivisionConfig[];
};

const DEFAULT_FORM_VALUES: FormValues = {
  name: '',
  cellSizeRatio: 1,
  order: 0,
};

/** Form-mode controls whether the right-hand panel is rendered. */
type Mode = 'idle' | 'creating' | 'editing';

export function SubdivisionManager({ isOpen, onClose, subdivisions }: Props) {
  // Local copy of subdivisions. Synced with the parent prop on every modal
  // open so external changes (e.g. another tab) still show up next time the
  // user opens the manager.
  const [local, setLocal] = useState<SubdivisionConfig[]>(subdivisions);
  const [mode, setMode] = useState<Mode>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen) {
      setLocal(subdivisions);
      setMode('idle');
      setEditingId(null);
    }
  }, [isOpen, subdivisions]);

  const methods = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const closeForm = () => {
    setEditingId(null);
    setError(null);
    methods.reset(DEFAULT_FORM_VALUES);
    setMode('idle');
  };

  const handleNew = () => {
    setEditingId(null);
    setError(null);
    const maxOrder = local.reduce((max, s) => Math.max(max, s.order), -1);
    methods.reset({ ...DEFAULT_FORM_VALUES, order: maxOrder + 1 });
    setMode('creating');
  };

  const handleEdit = (sub: SubdivisionConfig) => {
    setEditingId(sub.id);
    setError(null);
    methods.reset({
      name: sub.name,
      cellSizeRatio: sub.cellSizeRatio,
      order: sub.order,
    });
    setMode('editing');
  };

  const handleDelete = (sub: SubdivisionConfig) => {
    if (!confirm(`¿Borrar "${sub.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteSubdivision({ id: sub.id });
      if (!res.success) {
        setError(res.error.message);
      } else {
        setLocal((prev) => prev.filter((s) => s.id !== sub.id));
        if (editingId === sub.id) closeForm();
      }
    });
  };

  const onSubmit = methods.handleSubmit((data) => {
    startTransition(async () => {
      const isEditing = editingId !== null;
      const action = isEditing
        ? await updateSubdivision({ id: editingId!, ...data })
        : await createSubdivision(data);
      if (!action.success) {
        setError(action.error.message);
        return;
      }
      // Reflect the mutation locally so the list updates without waiting for
      // the parent to re-fetch. The parent's handleCloseManager still does a
      // full re-fetch when the modal closes, so we stay in sync.
      if (isEditing) {
        setLocal((prev) =>
          prev.map((s) => (s.id === editingId ? { ...s, ...data, id: editingId! } : s)),
        );
      } else if (action.data) {
        setLocal((prev) => [...prev, action.data]);
      }
      closeForm();
    });
  });

  return (
    <Modal
      isOpen={isOpen}
      title="Administrar subdivisions"
      onClose={() => {
        closeForm();
        onClose();
      }}
    >
      <div className={styles.subdivisionManager} data-mode={mode}>
        {/* ─── LISTA (siempre visible) ─── */}
        <aside className={styles.subdivisionList}>
          <div className={styles.subdivisionListHeader}>
            <h3>Subdivisions</h3>
            <Button type="button" variant="primary" size="mini" onClick={handleNew}>
              + Nueva
            </Button>
          </div>
          {local.length === 0 ? (
            <Empty>No hay subdivisions todavía.</Empty>
          ) : (
            <ul className={styles.subdivisionListItems}>
              {local.map((sub) => {
                const isEditing = editingId === sub.id;
                const itemClass = isEditing
                  ? `${styles.subdivisionListItem} ${styles.editing}`
                  : styles.subdivisionListItem;
                return (
                  <li key={sub.id} className={itemClass}>
                    <button
                      type="button"
                      className={styles.subdivisionListCard}
                      onClick={() => handleEdit(sub)}
                    >
                      <div className={styles.subdivisionListCardMain}>
                        <strong>{sub.name}</strong>
                        <span className={styles.subdivisionListMeta}>
                          ratio {sub.cellSizeRatio} · z {sub.order}
                        </span>
                      </div>
                    </button>
                    <div className={styles.subdivisionListActions}>
                      <Button type="button" size="mini" onClick={() => handleEdit(sub)}>
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="mini"
                        variant="danger"
                        onClick={() => handleDelete(sub)}
                      >
                        Borrar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ─── FORM (solo al crear/editar) ─── */}
        {mode !== 'idle' ? (
          <FormProvider {...methods}>
            <form onSubmit={onSubmit} className={styles.subdivisionForm}>
              <header className={styles.subdivisionFormHeader}>
                <h3>{editingId ? 'Editar' : 'Nueva'} subdivision</h3>
                <Button
                  type="button"
                  size="mini"
                  onClick={closeForm}
                  aria-label="Volver a la lista"
                >
                  ← Volver
                </Button>
              </header>

              {error ? <p className={styles.error}>{error}</p> : null}

              <div className={styles.subdivisionFormGrid}>
                <FormField label="Nombre" htmlFor="name">
                  <FormInput name="name" placeholder="Ej: Suelo, Objetos…" />
                </FormField>
                <FormField label="cellSizeRatio" htmlFor="cellSizeRatio">
                  <FormNumberInput name="cellSizeRatio" min={1} max={64} />
                </FormField>
                <FormField label="Orden (Z)" htmlFor="order">
                  <FormNumberInput name="order" min={0} max={20} />
                </FormField>
              </div>

              <p className={styles.subdivisionFormNote}>
                Las piezas son globales: cualquier pieza puede pintarse en cualquier subdivision.
                Administra las piezas en <strong>Administrar piezas</strong> (en la página
                principal).
              </p>

              <footer className={styles.subdivisionFormActions}>
                <Button type="button" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={methods.formState.isSubmitting}>
                  {methods.formState.isSubmitting
                    ? 'Guardando…'
                    : editingId
                      ? 'Guardar cambios'
                      : 'Crear subdivision'}
                </Button>
              </footer>
            </form>
          </FormProvider>
        ) : null}
      </div>
    </Modal>
  );
}
