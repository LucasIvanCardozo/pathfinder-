'use client';

import type { CSSProperties, ReactNode } from 'react';
import styles from './EffectMarkerRow.module.css';

export type EffectMarkerRowProps = {
  /** Marker colour. Pushed into the CSS custom prop so the module owns the
   *  visual rules (per `docs/patterns/css-modules.md`). */
  color: string;
  label: string;
  /** Renders the "Dismissed" tag and triggers the `data-dismissed` styling. */
  dismissed?: boolean;
  /** `list` for the modal's list pane (full row with optional trailing slot);
   *  `compact` for the tooltip's header (label-only, no trailing). */
  variant?: 'list' | 'compact';
  /** Optional slot for action buttons, meta text, or any other content that
   *  should sit to the right of the label. */
  trailing?: ReactNode;
};

/**
 * Shared "color swatch + label" row used by the EffectsModal's list and the
 * EffectTooltip's header. Extracted because both surfaces duplicated the same
 * structure with cosmetic tweaks — and any change to the swatch/label chrome
 * now lives in one CSS module.
 *
 * The row is intentionally a presentational `<div>` (no `onClick`, no `role`)
 * so it can sit inside the modal's `<li>` and the tooltip's portal without
 * nesting interactive elements. When the parent needs a clickable area (the
 * modal's list row), it wraps this component in a `<button>` — the row
 * itself owns only the swatch + label + trailing slot, never the click.
 */
export function EffectMarkerRow({
  color,
  label,
  dismissed = false,
  variant = 'list',
  trailing,
}: EffectMarkerRowProps) {
  return (
    <div
      className={styles.row}
      data-variant={variant}
      data-dismissed={dismissed ? 'true' : undefined}
      style={{ '--swatch-color': color } as CSSProperties}
    >
      <span className={styles.swatch} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
      {dismissed && variant === 'list' ? (
        <span className={styles.dismissedTag}>Dismissed</span>
      ) : null}
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
