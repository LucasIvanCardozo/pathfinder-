'use client';

import Image from 'next/image';
import traitBadgeStyles from '@/components/trait-badge.module.css';
import type { Piece } from '@/lib/shared/types';
import styles from './piece-palette.module.css';

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
    <div className={styles.palette}>
      <h3 className={styles.paletteTitle}>Piezas</h3>
      <div className={styles.paletteGrid}>
        {pieces.map((piece) => {
          const def = piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0];
          if (!def) return null;
          const multipleStates = piece.visualStates.length > 1;
          return (
            <button
              key={piece.id}
              type="button"
              className={`${styles.card} ${piece.id === activePieceId ? styles.active : ''}`}
              onClick={() => onSelect(piece.id)}
              title={
                multipleStates ? `${piece.name} (${piece.visualStates.length} estados)` : piece.name
              }
            >
              <Image
                src={def.imagePath}
                alt={piece.name}
                width={piece.width}
                height={piece.height}
                sizes="128px"
                draggable={false}
              />
              <span>{piece.name}</span>
              {piece.traits && piece.traits.length > 0 ? (
                <div>
                  {piece.traits.map((t) => (
                    <span key={t.kind} className={traitBadgeStyles.traitBadge} title={t.kind}>
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
