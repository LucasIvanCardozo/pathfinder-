import styles from './spinner.module.css';

type Props = {
  /** Visual size in CSS pixels. Defaults to 14 — fits inside a normal-sized
   *  button without shifting the layout. */
  size?: number;
  /** Accessible label; screen readers announce this while the spinner runs.
   *  Defaults to a generic "Cargando". */
  label?: string;
};

/**
 * Tiny inline SVG spinner. A single quarter-arc that rotates via CSS
 * animation — no JS, no external assets, ~600 bytes gzipped including the
 * CSS module. Reused wherever a button or status pill needs a "running"
 * affordance (saving scenario, autosave tick, etc.).
 *
 * The arc length matches a 25 % gap so the visual rotation looks continuous
 * even at low frame rates (the browser may batch frames when the tab is
 * backgrounded).
 */
export function Spinner({ size = 14, label = 'Cargando' }: Props) {
  return (
    <span
      className={styles.spinner}
      role="status"
      aria-label={label}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="42 100"
        />
      </svg>
    </span>
  );
}
