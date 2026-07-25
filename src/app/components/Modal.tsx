"use client";

import { type ReactNode, useEffect } from "react";

type ModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Generic modal dialog. Renders a backdrop + centered content panel.
 * Closes on Escape or backdrop click. A native <dialog> is used as the
 * backdrop so screen readers and keyboard handlers get the right semantics
 * for free.
 */
export function Modal({ isOpen, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop intentionally closes on click.
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is the documented close affordance.
    <div
      className="modal-backdrop"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
