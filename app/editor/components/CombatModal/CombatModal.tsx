'use client';

import { faPlus, faShieldHalved, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form';
import { Modal } from '@/components/Modal';
import { SIDE_LABEL } from '@/lib/shared/constants';
import { CombatantInsertSchema } from '@/lib/shared/schemas/combat.schemas';
import type { CombatView, Combatant, CombatantInsert, Side } from '@/lib/shared/types';
import { newId } from '@/lib/shared/utils/generateId';
import styles from './CombatModal.module.css';

export interface CombatModalProps {
  isOpen: boolean;
  onClose: () => void;
  combat: CombatView | null;
  onStartCombat: (combatants: CombatantInsert[]) => void;
  onEndCombat: () => void;
  onAddCombatant: (combatant: CombatantInsert) => void;
  onRemoveCombatant: (combatantId: string) => void;
}

type DraftCombatant = CombatantInsert & { draftId: string };
type ListedCombatant = Combatant | DraftCombatant;

type SideOption = { value: Side; label: string };

const SIDE_OPTIONS: SideOption[] = [
  { value: 'players', label: SIDE_LABEL.players },
  { value: 'enemies', label: SIDE_LABEL.enemies },
  { value: 'neutral', label: SIDE_LABEL.neutral },
];

const DEFAULT_VALUES: CombatantInsert = {
  name: '',
  initiative: 0,
  side: 'neutral',
};

/**
 * List-and-editor modal for starting a combat or managing its participants.
 * The form is **always visible** alongside the list: pre-combat, the user
 * fills one combatant at a time and they stack on the draft list until
 * "Iniciar combate"; mid-combat, every submission is appended to the live
 * combatants list and the form clears for the next entry. The "Agregar"
 * toggle button and `mode` prop from the previous design are gone — the
 * modal itself is the single affordance for adding combatants.
 *
 * Initial participants stay local until `onStartCombat`; active-combat
 * changes are sent to the parent's op-backed handlers as soon as they are
 * submitted.
 */
export function CombatModal({
  isOpen,
  onClose,
  combat,
  onStartCombat,
  onEndCombat,
  onAddCombatant,
  onRemoveCombatant,
}: CombatModalProps) {
  const [draftCombatants, setDraftCombatants] = useState<DraftCombatant[]>([]);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const methods = useForm<CombatantInsert>({
    resolver: zodResolver(CombatantInsertSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });
  const hasCombat = combat !== null;
  // Reset local state and form whenever the modal opens. ESC / X close the
  // modal; on reopen the user starts from defaults with an empty (or live)
  // list.
  useEffect(() => {
    if (!isOpen) {
      setConfirmEnd(false);
      setDraftCombatants([]);
      return;
    }
    setConfirmEnd(false);
    if (hasCombat) setDraftCombatants([]);
    methods.reset(DEFAULT_VALUES);
  }, [hasCombat, isOpen, methods]);

  const listedCombatants: ListedCombatant[] = combat?.combatants ?? draftCombatants;

  const handleAdd = (values: CombatantInsert) => {
    if (combat) {
      onAddCombatant(values);
    } else {
      setDraftCombatants((current) => [...current, { ...values, draftId: newId('combatant') }]);
    }
    methods.reset(DEFAULT_VALUES);
  };

  const handleRemove = (combatant: ListedCombatant) => {
    if (combat) {
      if ('id' in combatant && combatant.id) {
        onRemoveCombatant(combatant.id);
        return;
      }
    }
    if ('draftId' in combatant) {
      setDraftCombatants((current) => current.filter((item) => item.draftId !== combatant.draftId));
    }
  };

  const handleStart = () => {
    onStartCombat(draftCombatants.map(({ draftId: _draftId, ...combatant }) => combatant));
    onClose();
  };

  const handleEnd = () => {
    if (!confirmEnd) {
      setConfirmEnd(true);
      return;
    }
    onEndCombat();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} title={combat ? 'Combate' : 'Nuevo combate'} onClose={onClose}>
      <div className={styles.shell}>
        <aside className={styles.listPane}>
          <header className={styles.listHeader}>
            <div>
              <h3>Combatientes</h3>
              <span className={styles.count}>{listedCombatants.length}</span>
            </div>
          </header>
          <ul className={styles.list}>
            {listedCombatants.length === 0 ? (
              <li className={styles.empty}>Todavía no hay combatientes.</li>
            ) : (
              listedCombatants.map((combatant) => {
                const key = 'id' in combatant ? combatant.id : combatant.draftId;
                return (
                  <li key={key} className={styles.row} data-side={combatant.side}>
                    <div className={styles.rowInfo}>
                      <strong>{combatant.name}</strong>
                      <span>
                        {combatant.initiative} · {SIDE_LABEL[combatant.side]}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={() => handleRemove(combatant)}
                      aria-label={`Quitar ${combatant.name}`}
                    >
                      Quitar
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className={styles.editorPane}>
          <CombatantForm
            methods={methods}
            isInitial={!combat}
            onSubmit={methods.handleSubmit(handleAdd)}
          />

          {combat ? (
            <footer className={styles.footer}>
              {confirmEnd ? (
                <div className={styles.confirm} role="alert">
                  <span>¿Finalizar y quitar todos los combatientes?</span>
                  <div className={styles.confirmActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setConfirmEnd(false)}
                    >
                      Cancelar
                    </button>
                    <button type="button" className={styles.dangerButton} onClick={handleEnd}>
                      Confirmar
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.dangerButton} onClick={handleEnd}>
                  <FontAwesomeIcon icon={faTimes} /> Finalizar combate
                </button>
              )}
            </footer>
          ) : (
            <footer className={styles.footer}>
              <p className={styles.hint}>Podés agregar varios combatientes antes de iniciar.</p>
              <button type="button" className={styles.primaryButton} onClick={handleStart}>
                <FontAwesomeIcon icon={faShieldHalved} /> Iniciar combate
              </button>
            </footer>
          )}
        </section>
      </div>
    </Modal>
  );
}

function CombatantForm({
  methods,
  isInitial,
  onSubmit,
}: {
  methods: UseFormReturn<CombatantInsert>;
  isInitial: boolean;
  onSubmit: () => void;
}) {
  const {
    register,
    formState: { errors },
  } = methods;

  return (
    <FormProvider {...methods}>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <header className={styles.editorHeader}>
          <FontAwesomeIcon icon={faShieldHalved} />
          <h3>{isInitial ? 'Nuevo combatiente' : 'Agregar combatiente'}</h3>
        </header>

        <label className={styles.field}>
          <span>Nombre</span>
          <input type="text" maxLength={120} placeholder="Ej. Goblin 1" {...register('name')} />
          {errors.name ? <span className={styles.error}>{errors.name.message}</span> : null}
        </label>

        <label className={styles.field}>
          <span>Iniciativa</span>
          <input
            type="number"
            min={-10}
            max={40}
            step={1}
            {...register('initiative', { valueAsNumber: true })}
          />
          {errors.initiative ? (
            <span className={styles.error}>{errors.initiative.message}</span>
          ) : null}
        </label>

        <fieldset className={styles.field}>
          <legend>Lado</legend>
          <div className={styles.sideGroup}>
            {SIDE_OPTIONS.map((option) => (
              <label key={option.value} className={styles.sideOption}>
                <input type="radio" value={option.value} {...register('side')} />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {errors.side ? <span className={styles.error}>{errors.side.message}</span> : null}
        </fieldset>

        <footer className={styles.formFooter}>
          <button type="submit" className={styles.primaryButton}>
            <FontAwesomeIcon icon={faPlus} /> Agregar a la lista
          </button>
        </footer>
      </form>
    </FormProvider>
  );
}
