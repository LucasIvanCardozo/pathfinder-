"use client";

import Image from "next/image";
import type { Piece } from "@/pieces";

type Props = {
  pieces: Piece[];
  activePieceId: string | null;
  onSelect: (pieceId: string) => void;
};

/**
 * Vertical palette of pieces for the active subdivision. Click a card to
 * select the piece to paint with.
 *
 * Each card shows the piece's default visual state (or a small preview grid
 * if the piece has multiple states). Trait badges are rendered as tooltips.
 */
export function PiecePalette({ pieces, activePieceId, onSelect }: Props) {
  return (
    <div className="texture-palette">
      <h3 className="texture-palette-title">Piezas</h3>
      <div className="texture-palette-grid">
        {pieces.map((piece) => {
          const def = piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0];
          if (!def) return null;
          const multipleStates = piece.visualStates.length > 1;
          return (
            <button
              key={piece.id}
              type="button"
              className={`texture-palette-card ${piece.id === activePieceId ? "active" : ""}`}
              onClick={() => onSelect(piece.id)}
              title={
                multipleStates
                  ? `${piece.name} (${piece.visualStates.length} estados)`
                  : piece.name
              }
            >
              <div className="texture-palette-preview">
                <Image
                  src={def.imagePath}
                  alt={piece.name}
                  width={piece.width}
                  height={piece.height}
                  sizes="128px"
                  draggable={false}
                />
                {multipleStates ? (
                  <div className="texture-palette-states">
                    {piece.visualStates.slice(0, 4).map((v) => (
                      <Image
                        key={v.id}
                        src={v.imagePath}
                        alt={v.id}
                        width={24}
                        height={24}
                        sizes="24px"
                        className="texture-palette-state"
                        draggable={false}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <span>{piece.name}</span>
              {piece.traits && piece.traits.length > 0 ? (
                <div className="texture-palette-traits">
                  {piece.traits.map((t) => (
                    <span key={t.kind} className="trait-badge" title={t.kind}>
                      {t.kind}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}