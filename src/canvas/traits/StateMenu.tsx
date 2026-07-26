"use client";

import { useEffect } from "react";
import "./state-menu.css";

type StateMenuProps = {
  /** All valid state values for this trait. */
  states: readonly string[];
  /** Human-readable label per state. */
  labels: Record<string, string>;
  /** Current state. */
  current: string | undefined;
  /** Called when the user picks a new state. */
  onChange: (newState: string) => void;
  /** Called when the menu should close (click outside, Esc, X button). */
  onClose: () => void;
  /** Title shown in the menu header (e.g. "Puerta"). */
  title: string;
  /** Optional className for the root element. */
  className?: string;
};

/**
 * Generic state-picker menu. Any trait with a finite set of states can use
 * this component via `getMenu` in the trait registry.
 */
export function StateMenu({
  states,
  labels,
  current,
  onChange,
  onClose,
  title,
  className,
}: StateMenuProps) {
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest(".state-menu")) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const t = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown, true);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div className={`state-menu ${className ?? ""}`}>
      <div className="state-menu-header">
        <span>
          {title} · {labels[current ?? states[0] ?? ""] ?? current}
        </span>
        <button
          type="button"
          className="state-menu-close"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          ×
        </button>
      </div>
      <div className="state-menu-section">
        <span className="state-menu-label">Cambiar estado</span>
        <div className="state-menu-states">
          {states.map((s) => (
            <button
              key={s}
              type="button"
              className={`state-btn ${s === current ? "active" : ""}`}
              onClick={() => onChange(s)}
              data-state={s}
            >
              {labels[s] ?? s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}