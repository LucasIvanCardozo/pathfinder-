"use client";

import { useEffect } from "react";
import type { Door, DoorState } from "@/pieces";
import { doorStateLabel, ALL_DOOR_STATES } from "@/canvas";
import "./door-menu.css";

type Props = {
  door: Door;
  position: { x: number; y: number };
  onChangeState: (state: DoorState) => void;
  onClose: () => void;
};

export function DoorMenu({ door, position, onChangeState, onClose }: Props) {
  // Click outside the menu closes it.
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest(".door-menu")) {
        onClose();
      }
    };
    // Use a small delay so the click that opened the menu doesn't immediately
    // close it. Capture phase to fire before any other handler.
    const t = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown, true);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [onClose]);

  return (
    <div className="door-menu" style={{ left: position.x, top: position.y }}>
      <div className="door-menu-header">
        <span>Puerta · {doorStateLabel(door.state)}</span>
        <button
          type="button"
          className="door-menu-close"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          ×
        </button>
      </div>
      <div className="door-menu-section">
        <span className="door-menu-label">Cambiar estado</span>
        <div className="door-menu-states">
          {ALL_DOOR_STATES.map((s) => (
            <button
              key={s}
              type="button"
              className={`door-state-btn ${s === door.state ? "active" : ""}`}
              onClick={() => onChangeState(s)}
              data-state={s}
            >
              {doorStateLabel(s)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
