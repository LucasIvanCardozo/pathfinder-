'use client';

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHORTCUTS } from '@/lib/shared/constants';
import styles from './Popover.module.css';

type Side = 'right' | 'left' | 'top' | 'bottom';

type PopoverProps = {
  /** Anchor element (typically a Button). The popover positions itself relative
   *  to this element's bounding rect. */
  trigger: ReactNode;
  /** Content. Function form receives `close()` for cases that want to close on
   *  action (e.g. a menu item that runs a command). */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Preferred side. Default 'right'. The popover flips if it would overflow
   *  the viewport. */
  side?: Side;
  /** Controlled open state. When provided, the component renders conditionally
   *  and becomes a fully controlled widget. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra class for the panel (e.g. width customization). */
  className?: string;
  ariaLabel?: string;
};

const GAP_PX = 8;
const VIEWPORT_MARGIN = 8;

/**
 * Anchored popover primitive. Replaces ad-hoc `position: fixed` menus across
 * the editor: triggers stay inline where they were, the panel opens beside
 * them.
 *
 * Why a portal: the editor's `.editor` has `overflow: hidden`, so any fixed
 * child is clipped at the editor's box. Rendering into `document.body` via
 * `createPortal` puts the panel on top of the whole tree, including the
 * floating aside chrome.
 *
 * Why `data-popover-panel` / `data-popover-trigger` instead of class names:
 * CSS Modules hashes the class names, so a `closest()` lookup against the
 * hashed class would break the moment the styles change. The data attribute
 * is stable across refactors and is the same pattern `StateMenu` uses.
 *
 * Controlled vs uncontrolled: when `open` is undefined the component manages
 * its own state via trigger clicks; when `open` is provided the parent owns
 * the state and the component reflects it. The Escape / click-outside handlers
 * always notify `onOpenChange` so the parent can decide to close.
 */
export function Popover({
  trigger,
  children,
  side = 'right',
  open,
  onOpenChange,
  className,
  ariaLabel,
}: PopoverProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? open : internalOpen;

  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, onOpenChange]);

  const toggle = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(!open);
    } else {
      setInternalOpen((prev) => !prev);
    }
  }, [isControlled, onOpenChange, open]);

  // Position the panel next to the trigger after mount + on every open. Uses
  // `useLayoutEffect` so the panel paints at the final position before the
  // browser commits the frame — avoids a single-frame jump at the origin.
  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }
    const triggerEl = triggerRef.current;
    const panelEl = panelRef.current;
    if (!triggerEl || !panelEl) return;

    const measure = () => {
      const rect = triggerEl.getBoundingClientRect();
      const panelRect = panelEl.getBoundingClientRect();
      const panelWidth = panelRect.width;
      const panelHeight = panelRect.height;

      const roomRight = window.innerWidth - rect.right;
      const roomLeft = rect.left;
      const roomBottom = window.innerHeight - rect.bottom;
      const roomTop = rect.top;

      // Flip on each axis independently so the panel stays in the viewport
      // even when the trigger is in a corner.
      const resolvedSide: Side = (() => {
        if (side === 'right' && roomRight < panelWidth + GAP_PX && roomLeft > roomRight) {
          return 'left';
        }
        if (side === 'left' && roomLeft < panelWidth + GAP_PX && roomRight > roomLeft) {
          return 'right';
        }
        if (side === 'bottom' && roomBottom < panelHeight + GAP_PX && roomTop > roomBottom) {
          return 'top';
        }
        if (side === 'top' && roomTop < panelHeight + GAP_PX && roomBottom > roomTop) {
          return 'bottom';
        }
        return side;
      })();

      let top = 0;
      let left = 0;
      switch (resolvedSide) {
        case 'right':
          top = rect.top;
          left = rect.right + GAP_PX;
          break;
        case 'left':
          top = rect.top;
          left = rect.left - panelWidth - GAP_PX;
          break;
        case 'bottom':
          top = rect.bottom + GAP_PX;
          left = rect.left;
          break;
        case 'top':
          top = rect.top - panelHeight - GAP_PX;
          left = rect.left;
          break;
      }

      // Clamp into the viewport with a small margin so the panel never sits
      // flush against the edge (which looks like a rendering bug).
      const maxLeft = window.innerWidth - panelWidth - VIEWPORT_MARGIN;
      const maxTop = window.innerHeight - panelHeight - VIEWPORT_MARGIN;
      left = Math.min(Math.max(VIEWPORT_MARGIN, left), Math.max(VIEWPORT_MARGIN, maxLeft));
      top = Math.min(Math.max(VIEWPORT_MARGIN, top), Math.max(VIEWPORT_MARGIN, maxTop));

      setCoords({ top, left });
    };

    measure();
    // Re-measure on viewport resize so the panel follows the trigger if the
    // window changes between open and close.
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, side]);

  // Click outside + Escape. Mirrors the StateMenu pattern verbatim: the
  // capture-phase pointerdown fires before the trigger's own click would
  // toggle the panel back open, so we close first and the trigger click
  // toggles it back to closed (idempotent). The setTimeout defers listener
  // registration past the current event loop tick so the click that opened
  // the popover doesn't immediately close it.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-popover-trigger]')) return;
      if (target.closest('[data-popover-panel]')) return;
      // Stop the event here so it never reaches the canvas underneath.
      // Without this, Konva's pointerdown handler runs after we close the
      // popover and starts a paint stroke — clicking "outside" the popover
      // also paints on the map. `stopPropagation` blocks further listener
      // dispatch; `preventDefault` blocks any default browser behaviour
      // (focus moves, native drag, etc.).
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === SHORTCUTS.closeOverlay.code) close();
    };
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, close]);

  const panelClass = className ? `${styles.panel} ${className}` : styles.panel;

  return (
    <>
      {/*
        biome-ignore lint/a11y/noStaticElementInteractions: the trigger is a
        Button (a native focusable element) rendered inside this positioning
        wrapper. The span is just a host for the trigger's bounding rect and
        the click-outside data attribute; all interactivity lives on the
        button itself (which handles Enter/Space naturally).
        biome-ignore lint/a11y/useKeyWithClickEvents: the wrapper has no
        native keyboard activation of its own (it's a non-focusable span);
        keyboard activation on the Button inside bubbles a click here, so
        the wrapper doesn't need its own onKeyDown.
      */}
      <span ref={triggerRef} data-popover-trigger className={styles.trigger} onClick={toggle}>
        {trigger}
      </span>
      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              data-popover-panel
              data-side={side}
              data-state={coords ? 'open' : 'measuring'}
              role="dialog"
              aria-label={ariaLabel}
              className={panelClass}
              style={{
                position: 'fixed',
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                visibility: coords ? 'visible' : 'hidden',
              }}
            >
              {typeof children === 'function' ? children(close) : children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
