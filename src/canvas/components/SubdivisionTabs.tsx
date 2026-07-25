"use client";

import { useState } from "react";
import type { SubdivisionConfig } from "@/pieces";
import { DOORS_SUBDIVISION_NAME, filterVisibleSubdivisions } from "../subdivisions";

type Props = {
  subdivisions: SubdivisionConfig[];
  activeId: string;
  onChange: (id: string) => void;
  /**
   * Called when the user drops a tab on another tab. `fromId` is the tab
   * being dragged; `toId` is the tab it was dropped on; `side` is which
   * half of the target the cursor was over ("left" or "right").
   */
  onReorder: (fromId: string, toId: string, side: "left" | "right") => void;
};

type DropIndicator = { id: string; side: "left" | "right" } | null;

/**
 * Subdivision tab strip. Regular subdivisions are draggable so the user
 * can reorder them; the "Puertas" tab is intentionally fixed at the end
 * (its separator marks it as a special-destination tab, not a peer).
 */
export function SubdivisionTabs({ subdivisions, activeId, onChange, onReorder }: Props) {
  const doorsSub = subdivisions.find((s) => s.name === DOORS_SUBDIVISION_NAME);
  const visible = filterVisibleSubdivisions(subdivisions);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? "left" : "right";
    setDropIndicator({ id, side });
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropIndicator(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const fromId = e.dataTransfer.getData("text/plain");
    if (!fromId || !dropIndicator || fromId === dropIndicator.id) {
      handleDragEnd();
      return;
    }
    onReorder(fromId, dropIndicator.id, dropIndicator.side);
    handleDragEnd();
  };

  return (
    <div className="subdivision-tabs" role="tablist">
      {visible.map((sub) => {
        const isDragging = draggingId === sub.id;
        const indicatorHere =
          dropIndicator && dropIndicator.id === sub.id ? dropIndicator.side : null;
        return (
          <div
            key={sub.id}
            className={`subdivision-tab-wrapper ${indicatorHere ? `drop-${indicatorHere}` : ""}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={sub.id === activeId}
              draggable
              className={`subdivision-tab ${
                sub.id === activeId ? "active" : ""
              } ${isDragging ? "dragging" : ""}`}
              onClick={() => onChange(sub.id)}
              onDragStart={(e) => handleDragStart(e, sub.id)}
              onDragOver={(e) => handleDragOver(e, sub.id)}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            >
              {sub.name}
            </button>
          </div>
        );
      })}
      {doorsSub ? (
        <>
          <span className="subdivision-tabs-separator" aria-hidden="true" />
          <button
            type="button"
            role="tab"
            aria-selected={doorsSub.id === activeId}
            className={`subdivision-tab doors-tab ${doorsSub.id === activeId ? "active" : ""}`}
            onClick={() => onChange(doorsSub.id)}
            title="Activar la subcapa Puertas"
          >
            🚪 Puertas
          </button>
        </>
      ) : null}
    </div>
  );
}
