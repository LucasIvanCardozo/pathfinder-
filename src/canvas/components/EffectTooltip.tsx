'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/Modal';
import type { ScenarioEffect } from '@/lib/shared/types';
import type { EffectMarkerCell } from '../hooks/useEffectMarkers';
import { EffectMarkerRow } from './EffectMarkerRow';
import styles from './effect-tooltip.module.css';

/**
 * Props for the marker tooltip. The tooltip is mounted by the canvas when the
 * user clicks a marker and is unmounted on the next click anywhere on the
 * canvas (or on Escape). The parent (EffectsLayer / FloorCanvas) is the
 * single source of truth for the `isOpen` state.
 */
export type EffectTooltipProps = {
  /** The effect this tooltip is describing. */
  effect: ScenarioEffect;
  /** Number of effects that cover this cell (>= 1). */
  overlappingCount: number;
  /** Position in the Konva stage container's coordinate space (what
   *  `Konva.Stage.getPointerPosition()` returns). Converted to viewport
   *  coords at mount so the portal can use `position: fixed` without
   *  being clipped by the editor's `overflow: hidden`. */
  position: { x: number; y: number };
  /** Wire from the "Editar" button — opens the modal preloaded with this effect. */
  onEdit: () => void;
  /** Wire from the "Dismiss" button (PR 2: visual-only). */
  onDismiss: () => void;
  /** Wire from the "Dispel Magic" button — hard-remove via `removeEffect`. */
  onDispel: () => void;
  /** Wire from the "Force Dismiss (sin D)" button — same op as Dismiss, but
   *  gated by a confirm dialog (analytics + explicit GM intent). */
  onForceDismiss: () => void;
  /** True when the effect has been dismissed. Affects the label pill. */
  dismissed?: boolean;
};

/**
 * Marker tooltip rendered through a portal at `document.body` with
 * `position: fixed`. The previous implementation wrapped the content in
 * `<Popover>` with a 1x1 hidden trigger at (0, 0) of the editor tree and
 * the content positioned absolutely on top — the Popover was re-anchoring
 * the panel relative to the trigger (not the click point) so the tooltip
 * landed at an offset that compounded with the absolute `left`/`top` of
 * the inner div. PR 2 fix: drop the Popover wrapper, portal the tooltip
 * to the body, and convert the stage-relative pointer position to
 * viewport coords so `position: fixed` pins the tooltip at the click
 * point regardless of the editor's overflow rules.
 *
 * Action buttons:
 *   - **Editar** — opens the modal preloaded with this effect.
 *   - **Dismiss** — visual-only state (the row stays in the DB and the
 *     marker renders at reduced opacity with a "Dismissed" tag).
 *   - **Dispel Magic** — same wire as Dismiss; kept distinct in the UI
 *     for analytics. PR 4 leaves the wire in place.
 *   - **Force Dismiss (sin D)** — same op as Dismiss but gated by a
 *     confirm modal; the GM use case is "I want to dismiss this even
 *     though I am not in the dismiss flow" (analytics + intent).
 */
export function EffectTooltip({
  effect,
  overlappingCount,
  position,
  onEdit,
  onDismiss,
  onDispel,
  onForceDismiss,
  dismissed = false,
}: EffectTooltipProps) {
  // Konva's `getPointerPosition()` returns stage-relative coords. Add the
  // stage container's viewport origin so `position: fixed` lands on the
  // click point. `useLayoutEffect` runs synchronously before paint so the
  // tooltip never flashes at (0, 0).
  const [viewportPos, setViewportPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmForceDismiss, setConfirmForceDismiss] = useState(false);

  useLayoutEffect(() => {
    const stageEl = document.querySelector<HTMLElement>('.konvajs-content');
    if (!stageEl) {
      // Fallback: assume the position is already viewport-relative. The
      // EffectsLayer is the only caller and it always passes stage-relative
      // coords, so this branch is mostly defensive (covers the no-stage
      // edge case during hot reload).
      setViewportPos(position);
      return;
    }
    const rect = stageEl.getBoundingClientRect();
    setViewportPos({ x: rect.left + position.x, y: rect.top + position.y });
  }, [position]);

  if (!viewportPos) return null;

  return createPortal(
    <div
      role="tooltip"
      className={styles.tooltip}
      style={{ left: viewportPos.x, top: viewportPos.y }}
    >
      <EffectMarkerRow
        color={effect.color}
        label={effect.label}
        dismissed={dismissed}
        variant="compact"
      />
      <dl className={styles.meta}>
        <div className={styles.metaRow}>
          <dt>Rondas</dt>
          <dd>{effect.remainingRounds}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>Tipo</dt>
          <dd>{effect.kind}</dd>
        </div>
        {overlappingCount > 1 ? (
          <div className={styles.metaRow}>
            <dt>Cobertura</dt>
            <dd>
              <FontAwesomeIcon icon={faWandMagicSparkles} /> {overlappingCount} effects aquí
            </dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={onEdit}>
          Editar
        </button>
        <button type="button" className={styles.action} onClick={onDismiss}>
          Dismiss
        </button>
        <button type="button" className={`${styles.action} ${styles.danger}`} onClick={onDispel}>
          Dispel Magic
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.danger}`}
          onClick={() => setConfirmForceDismiss(true)}
        >
          Force Dismiss (sin D)
        </button>
      </div>
      <Modal
        isOpen={confirmForceDismiss}
        title="¿Forzar Dismiss sin (D)?"
        onClose={() => setConfirmForceDismiss(false)}
      >
        <p style={{ marginTop: 0 }}>
          Esta acción aplica el mismo <code>dismissEffect</code> que el botón Dismiss, pero sin
          pasar por el atajo <kbd>D</kbd>. Útil para analítica y para registrar intención
          explícita del GM.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className={styles.action}
            onClick={() => setConfirmForceDismiss(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.danger}`}
            onClick={() => {
              setConfirmForceDismiss(false);
              onForceDismiss();
            }}
          >
            <FontAwesomeIcon icon={faClock} /> Forzar Dismiss
          </button>
        </div>
      </Modal>
    </div>,
    document.body,
  );
}

/**
 * Marker key helper. Used by the canvas to keep a single React key per
 * `(effect, gridX, gridY)` cell. Exposed here so the tooltip code can mirror
 * the same key when it needs to look up a tooltip target.
 */
export function effectMarkerKey(cell: EffectMarkerCell): string {
  return `effect-${cell.effect.id}-${cell.gridX}-${cell.gridY}`;
}
