import type { ReactNode } from 'react';
import styles from './FloatingPanel.module.css';

type As = 'header' | 'aside' | 'div';

type FloatingPanelProps = {
  /** Outer landmark. Default: `'div'`. */
  as?: As;
  /** Class on the outer wrapper. Use this to position and size the panel
   *  (e.g. `position: fixed; top: 1rem; ...`). The wrapper carries
   *  `pointer-events: none` from the consumer's CSS so the empty area around
   *  the panel does not block canvas interaction. */
  className?: string;
  /** Accessible label for the panel landmark. When `as` is not provided (or
   *  is `'div'`) and this label is set, the component also adds `role="region"`
   *  so the landmark is announced to assistive tech. When `as` is `'header'`
   *  or `'aside'` the implicit landmark role is preserved — overriding it with
   *  `region` would erase the landmark. */
  ariaLabel?: string;
  /** When `true`, the subtree is removed from the focus order and the
   *  accessibility tree. Use this while the panel is hidden but still in the
   *  DOM (e.g. via `opacity: 0` + `pointer-events: none`) so keyboard users
   *  cannot Tab into the hidden controls. */
  inert?: boolean;
  children: ReactNode;
};

/**
 * Floating panel primitive for chrome that sits above a full-viewport canvas.
 *
 * The outer wrapper is `pointer-events: none` (set by the consumer's CSS) so
 * the empty area around the panel does not intercept clicks — the canvas
 * underneath stays paintable and pannable when the user clicks "near" a
 * panel but not on it. The inner `.panel` is `pointer-events: auto` so its
 * children receive events normally. This is why the consumer's positioning
 * class lives on the outer wrapper, not on the inner panel.
 *
 * The inner `.panel` provides only the visual chrome (background, border,
 * border-radius, box-shadow). Inner padding and the flex direction that
 * lays out the children are the consumer's responsibility — style them via
 * a structural selector on the outer class (e.g. `.floatingHeader > div`).
 *
 * The `as` prop picks the semantic landmark (`header`, `aside`, `div`).
 * When `as === 'div'` and `ariaLabel` is provided, the component also
 * forwards `role="region"` so the div is announced as a region landmark.
 *
 * The `inert` prop (React 19.2 native boolean attribute) removes the subtree
 * from the focus order and the accessibility tree; pair it with visual
 * hiding (`opacity: 0`, `pointer-events: none`) so the panel can be
 * re-shown without a mount/unmount cycle.
 */
export function FloatingPanel({
  as: Component = 'div',
  className,
  ariaLabel,
  inert,
  children,
}: FloatingPanelProps) {
  const role = ariaLabel !== undefined && Component === 'div' ? 'region' : undefined;
  return (
    <Component className={className} aria-label={ariaLabel} role={role} inert={inert}>
      <div className={styles.panel}>{children}</div>
    </Component>
  );
}
