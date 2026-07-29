'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import type { Piece } from '@/lib/shared/types';
import { Empty } from '@/components/Empty';
import traitBadgeStyles from '@/components/trait-badge.module.css';
import styles from './pieces-gallery.module.css';

type Props = {
  pieces: Piece[];
};

type Filter = 'all' | 'single' | 'multi-state' | 'with-traits';

export function PiecesGallery({ pieces }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pieces.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.id.includes(q)) return false;
      if (filter === 'single' && p.visualStates.length !== 1) return false;
      if (filter === 'multi-state' && p.visualStates.length < 2) return false;
      if (filter === 'with-traits' && (!p.traits || p.traits.length === 0)) return false;
      return true;
    });
  }, [pieces, search, filter]);

  return (
    <section className={styles.gallery}>
      <header className={styles.galleryHeader}>
        <h1>Galería de objetos</h1>
        <p>
          {pieces.length} objeto(s). Cada objeto tiene uno o más <em>estados visuales</em> (ej: la
          puerta tiene cerrado, abierto y bloqueada).
        </p>
        <div>
          <input
            type="search"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.gallerySearch}
          />
          <div className={styles.galleryFilters}>
            <FilterPill onClick={() => setFilter('all')}>Todos</FilterPill>
            <FilterPill onClick={() => setFilter('single')}>Simples</FilterPill>
            <FilterPill onClick={() => setFilter('multi-state')}>Multi-estado</FilterPill>
            <FilterPill onClick={() => setFilter('with-traits')}>Con traits</FilterPill>
          </div>
        </div>
      </header>

      <ul className={styles.galleryGrid}>
        {filtered.map((piece) => {
          const def = piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0];
          if (!def) return null;
          return (
            <li key={piece.id} className={styles.galleryCard}>
              <div className={styles.galleryCardImage}>
                <Image
                  src={def.imagePath}
                  alt={piece.name}
                  width={piece.width}
                  height={piece.height}
                  sizes="128px"
                />
              </div>
              <div className={styles.galleryCardBody}>
                <h3>{piece.name}</h3>
                <p className={styles.galleryCardId}>{piece.id}</p>
                <p className={styles.galleryCardMeta}>
                  {piece.width}×{piece.height}px · {piece.category}
                  {piece.visualStates.length > 1 ? ` · ${piece.visualStates.length} estados` : ''}
                </p>
                {piece.traits && piece.traits.length > 0 ? (
                  <ul>
                    {piece.traits.map((t) => (
                      <li
                        key={t.kind}
                        className={traitBadgeStyles.traitBadge}
                        title={JSON.stringify(t)}
                      >
                        {t.kind}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <a
                href={def.imagePath}
                target="_blank"
                rel="noreferrer"
                className={styles.galleryCardLink}
                title="Ver imagen por defecto"
              >
                Ver →
              </a>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? <Empty>No hay objetos que coincidan con el filtro.</Empty> : null}
    </section>
  );
}

function FilterPill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}
