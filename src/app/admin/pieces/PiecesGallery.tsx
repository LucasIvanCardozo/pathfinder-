"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Piece } from "@/pieces";
import "./gallery.css";

type Props = {
  pieces: Piece[];
};

type Filter = "all" | "single" | "multi-state" | "with-traits";

export function PiecesGallery({ pieces }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pieces.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.id.includes(q)) return false;
      if (filter === "single" && p.visualStates.length !== 1) return false;
      if (filter === "multi-state" && p.visualStates.length < 2) return false;
      if (filter === "with-traits" && (!p.traits || p.traits.length === 0)) return false;
      return true;
    });
  }, [pieces, search, filter]);

  return (
    <section className="gallery">
      <header className="gallery-header">
        <h1>Galería de objetos</h1>
        <p>
          {pieces.length} objeto(s). Cada objeto tiene uno o más <em>estados visuales</em>{" "}
          (ej: la puerta tiene cerrado, abierto y bloqueada).
        </p>
        <div className="gallery-toolbar">
          <input
            type="search"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="gallery-search"
          />
          <div className="gallery-filters">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
              Todos
            </FilterPill>
            <FilterPill active={filter === "single"} onClick={() => setFilter("single")}>
              Simples
            </FilterPill>
            <FilterPill
              active={filter === "multi-state"}
              onClick={() => setFilter("multi-state")}
            >
              Multi-estado
            </FilterPill>
            <FilterPill
              active={filter === "with-traits"}
              onClick={() => setFilter("with-traits")}
            >
              Con traits
            </FilterPill>
          </div>
        </div>
      </header>

      <ul className="gallery-grid">
        {filtered.map((piece) => {
          const def = piece.visualStates.find((v) => v.isDefault) ?? piece.visualStates[0];
          if (!def) return null;
          return (
            <li key={piece.id} className="gallery-card">
              <div className="gallery-card-image">
                <Image
                  src={def.imagePath}
                  alt={piece.name}
                  width={piece.width}
                  height={piece.height}
                  sizes="128px"
                />
                {piece.visualStates.length > 1 ? (
                  <div className="gallery-card-states">
                    {piece.visualStates.map((v) => (
                      <Image
                        key={v.id}
                        src={v.imagePath}
                        alt={v.id}
                        width={32}
                        height={32}
                        sizes="32px"
                        className="gallery-card-state"
                        title={v.id}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="gallery-card-body">
                <h3>{piece.name}</h3>
                <p className="gallery-card-id">{piece.id}</p>
                <p className="gallery-card-meta">
                  {piece.width}×{piece.height}px · {piece.category}
                  {piece.visualStates.length > 1
                    ? ` · ${piece.visualStates.length} estados`
                    : ""}
                </p>
                {piece.traits && piece.traits.length > 0 ? (
                  <ul className="gallery-card-traits">
                    {piece.traits.map((t) => (
                      <li key={t.kind} className="trait-badge" title={JSON.stringify(t)}>
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
                className="gallery-card-link"
                title="Ver imagen por defecto"
              >
                Ver →
              </a>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <p className="empty">No hay objetos que coincidan con el filtro.</p>
      ) : null}
    </section>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`gallery-filter-pill ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}