'use client';

import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ScenarioEffect } from '@/lib/shared/types';
import { Button } from '@/components/Button';
import { templateById } from '@/canvas/effects/spell-templates';
import styles from './effect-tooltip.module.css';

/**
 * Props for the marker tooltip. The tooltip is mounted by the canvas when
 * the user clicks a marker and is unmounted on the next click anywhere on
 * the canvas (or on Escape). The parent (FloorCanvas / EditorClient) is
 * the single source of truth for the `isOpen` state.
 */
export type EffectTooltipProps = {
  /** The effect this tooltip is describing. */
  effect: ScenarioEffect;
  /** Position in the Konva stage container's coordinate space (what
   *  `Konva.Stage.getPointerPosition()` returns). Converted to viewport
   *  coords at mount so the portal can use `position: fixed` without
   *  being clipped by the editor's `overflow: hidden`. */
  position: { x: number; y: number };
  /** Wire from the "Quitar" button — hard-removes the marker from the DB. */
  onRemove: () => void;
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
 * PR 2 of the spellcasting refactor collapsed the tooltip's action set to
 * just "Quitar" — there is no relabel, no dismiss visual-only state, no
 * Force Dismiss. The marker exists or it doesn't; `pushRemoveEffect`
 * deletes the row in the same TX as the next autosave.
 */
export function EffectTooltip({ effect, position, onRemove }: EffectTooltipProps) {
  const template = templateById(effect.templateId);
  // Konva's `getPointerPosition()` returns stage-relative coords. Add the
  // stage container's viewport origin so `position: fixed` lands on the
  // click point. `useLayoutEffect` runs synchronously before paint so the
  // tooltip never flashes at (0, 0).
  const [viewportPos, setViewportPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const stageEl = document.querySelector<HTMLElement>('.konvajs-content');
    if (!stageEl) {
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
      <div className={styles.header}>
        <span
          className={styles.swatch}
          style={{ background: template.color }}
          aria-hidden="true"
        />
        <span className={styles.label}>{template.label}</span>
      </div>
      <div className={styles.actions}>
        <Button
          type="button"
          size="mini"
          variant="danger"
          onClick={onRemove}
          title="Quitar el hechizo (borra la fila)"
        >
          Quitar
        </Button>
      </div>
    </div>,
    document.body,
  );
}
