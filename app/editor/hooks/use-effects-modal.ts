'use client';

import { useCallback, useState } from 'react';
import { EFFECT_PALETTE } from '@/lib/shared/constants';
import type { EffectInput, EffectKind, ScenarioEffect } from '@/lib/shared/types';
import { newId } from '@/lib/shared/utils/generateId';
import type { useOpsBuffer } from './use-ops-buffer';

export type OpsBuffer = ReturnType<typeof useOpsBuffer>;

/**
 * Form-level state for the EffectsModal editor. Mirrors the `EffectFormInput`
 * shape (the subset of `EffectInput` the modal collects) and is used internally
 * by `defaultDraft` to seed a freshly-created effect.
 *
 * The modal itself no longer reads this type — it uses react-hook-form's
 * `useForm<EffectInput>` so the schema (and the inferred form type) is the
 * single source of truth. The type stays exported for `defaultDraft`'s return
 * type and for any future unit tests that want to seed the form directly.
 */
export type EffectDraft = {
  /** Anchor cell coordinate on the active subdivision's grid (X axis). The
   *  modal pre-fills from the cell the GM clicked (creating) or from the
   *  existing effect (editing). */
  originCellX: number;
  /** Anchor cell coordinate on the active subdivision's grid (Y axis). */
  originCellY: number;
  label: string;
  kind: EffectKind;
  /** Footprint width in feet. */
  widthFt: number;
  /** Footprint depth (forward length) in feet. */
  depthFt: number;
  rotationDeg: number;
  color: string;
  durationKind: EffectInput['durationKind'];
  remainingRounds: number;
};

/**
 * Hook arguments. The modal needs:
 *   - `opsBuffer.push*` to record ops (the existing autosave drains them).
 *   - `activeFloorId` so the created effect renders on the right floor.
 *   - `effects` to seed the list view + the "Editar" preload.
 *   - `onRequestClose` callback so the parent can flip its modal-open ref.
 */
export type UseEffectsModalArgs = {
  opsBuffer: Pick<
    OpsBuffer,
    'pushAddEffect' | 'pushRemoveEffect' | 'pushRelabelEffect' | 'pushDismissEffect'
  >;
  activeFloorId: string;
  effects: readonly ScenarioEffect[];
  /** Optional callback fired when the modal opens — useful for the
   *  modal-guard ref. EditorClient wires this in PR 3. */
  onOpen?: () => void;
  onClose?: () => void;
};

/**
 * Default form values for a freshly-created effect. The kind is `burst`
 * (the simplest shape) and the dimensions/colour come from the palette
 * entries — the modal's kind-change handler mirrors this for the other
 * kinds, so a fresh marker opens at the same default the user gets when
 * they later pick `burst` from the radio.
 *
 * The anchor is the cell the GM clicked (passed in as `anchorCell`); the
 * editor's `useOpsBuffer` callers plumb the active subdivision's cell
 * coord here. No cellSize conversion happens because the wire shape is
 * already in cell coords (the rename from `originX`/`originY` metres to
 * `originCellX`/`originCellY` made this conversion unnecessary).
 */
export function defaultDraft(anchorCell?: { gridX: number; gridY: number }): EffectDraft {
  const originCellX = anchorCell?.gridX ?? 0;
  const originCellY = anchorCell?.gridY ?? 0;
  const palette = EFFECT_PALETTE.burst;
  return {
    originCellX,
    originCellY,
    label: '',
    kind: 'burst',
    widthFt: palette.defaultWidthFt,
    depthFt: palette.defaultDepthFt,
    rotationDeg: 0,
    color: palette.color,
    durationKind: 'rounds',
    remainingRounds: 10,
  };
}

/**
 * Build the full `EffectInput` (wire shape) from a form-shape `EffectDraft`
 * by padding the server-side fields. The hook calls this when the user
 * creates a new effect; the modal never sees the result directly because
 * it stores the full `EffectInput` in `defaultValues` and react-hook-form
 * reuses it on submit (so `data.id` and `data.floorId` round-trip without
 * a second synthesis step).
 */
export function draftToEffectInput(draft: EffectDraft, id: string, floorId: string): EffectInput {
  const now = new Date();
  return {
    id,
    floorId,
    label: draft.label,
    kind: draft.kind,
    originCellX: draft.originCellX,
    originCellY: draft.originCellY,
    widthFt: draft.widthFt,
    depthFt: draft.depthFt,
    rotationDeg: draft.rotationDeg,
    color: draft.color,
    durationKind: draft.durationKind,
    remainingRounds: draft.remainingRounds,
    expired: false,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Hook owning the EffectsModal open/close state, the selected effect, and the
 * form defaults. Op-buffer routing means the modal never calls a Server Action
 * directly — the existing `useScenarioAutosave` drains the buffer and ships
 * the ops in one batch with the paint/erase ops the GM produces meanwhile.
 *
 * `open` accepts an optional `activeCellSize` for backward compatibility with
 * EditorClient's existing call site. The value is ignored after the
 * `originX`/`originY` → `originCellX`/`originCellY` rename because the wire
 * is now in cell coords; the parameter is kept to spare EditorClient a
 * parallel change in this PR.
 */
export function useEffectsModal({
  opsBuffer,
  activeFloorId,
  effects,
  onOpen,
  onClose,
}: UseEffectsModalArgs) {
  const [isOpen, setIsOpen] = useState(false);
  /**
   * `defaultValues` holds the full `EffectInput` for the form. The modal
   * passes it to `useForm({ defaultValues })` so react-hook-form can hydrate
   * the form fields; the resolver (`EffectFormSchema`) only constrains the
   * user-facing fields, so the pre-filled `id` / `floorId` / `createdAt` /
   * `updatedAt` are passed through on submit without re-synthesis.
   */
  const [defaultValues, setDefaultValues] = useState<EffectInput | null>(null);
  /** When editing, the id of the effect being edited. `null` means creating. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const open = useCallback(
    (opts?: { anchorCell?: { gridX: number; gridY: number }; activeCellSize?: number }) => {
      const draft0 = defaultDraft(opts?.anchorCell);
      setDefaultValues(draftToEffectInput(draft0, newId('effect'), activeFloorId));
      setEditingId(null);
      setIsOpen(true);
      onOpen?.();
    },
    [onOpen, activeFloorId],
  );

  const openEdit = useCallback(
    (effectId: string) => {
      const found = effects.find((e) => e.id === effectId);
      if (!found) return;
      // Pre-fill the form with the existing effect verbatim — id and floorId
      // round-trip so the modal's `data` matches the row the user is editing.
      setDefaultValues({ ...found });
      setEditingId(effectId);
      setIsOpen(true);
      onOpen?.();
    },
    [effects, onOpen],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setDefaultValues(null);
    setEditingId(null);
    onClose?.();
  }, [onClose]);

  /**
   * Receive the react-hook-form–validated form data and route it to the right
   * op. The modal is the only caller; per the forms pattern the modal does NOT
   * close itself on success — we close here so the parent (EditorClient) and
   * the modal stay in sync via the `isOpen` state owned by this hook.
   *
   * The label fallback to "Marcador" preserves the PR 2 behaviour where a
   * blank label still produces a valid op (the form's `EffectFormSchema`
   * allows the empty string so the validation step does not block the
   * user from submitting without a name).
   */
  const submit = useCallback(
    (data: EffectInput) => {
      const label = data.label.trim() || 'Marcador';
      if (editingId) {
        opsBuffer.pushRelabelEffect(editingId, label);
      } else {
        opsBuffer.pushAddEffect({ ...data, label });
      }
      close();
    },
    [editingId, opsBuffer, close],
  );

  const dismiss = useCallback(
    (effectId: string) => {
      opsBuffer.pushDismissEffect(effectId);
    },
    [opsBuffer],
  );

  const remove = useCallback(
    (effectId: string) => {
      opsBuffer.pushRemoveEffect(effectId);
    },
    [opsBuffer],
  );

  return {
    isOpen,
    defaultValues,
    editingId,
    open,
    openEdit,
    close,
    submit,
    dismiss,
    remove,
  };
}
