"use client";

export type PaintTool = "paint" | "erase";

type Props = {
  tool: PaintTool;
  onChange: (tool: PaintTool) => void;
};

export function PaintToolbar({ tool, onChange }: Props) {
  return (
    <div className="paint-toolbar">
      <button
        type="button"
        className={`paint-tool ${tool === "paint" ? "active" : ""}`}
        onClick={() => onChange("paint")}
        title="Pintar (click + drag)"
      >
        🖌 Pintar
      </button>
      <button
        type="button"
        className={`paint-tool ${tool === "erase" ? "active" : ""}`}
        onClick={() => onChange("erase")}
        title="Borrar (click + drag)"
      >
        🧹 Borrar
      </button>
      </div>
  );
}
