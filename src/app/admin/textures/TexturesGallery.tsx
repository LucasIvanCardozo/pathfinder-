"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PieceCategory, Texture } from "@/pieces";
import "./gallery.css";

type Props = {
  textures: Texture[];
  categories: readonly PieceCategory[];
};

export function TexturesGallery({ textures, categories }: Props) {
  const [filterCategory, setFilterCategory] = useState<PieceCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return textures.filter((t) => {
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay =
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q));
        if (!hay) return false;
      }
      return true;
    });
  }, [textures, filterCategory, query]);

  const grouped = useMemo(() => {
    const map = new Map<PieceCategory, Texture[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <main className="gallery">
      <header className="gallery-header">
        <div>
          <h1>Galería de texturas</h1>
          <p className="gallery-subtitle">
            {textures.length} texturas disponibles en{" "}
            {new Set(textures.map((t) => t.category)).size} categorías
          </p>
        </div>
        <Link href="/editor" className="back-link">
          ← Volver al editor
        </Link>
      </header>

      <div className="gallery-filters">
        <input
          type="search"
          placeholder="Buscar por nombre, id o tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="gallery-search"
        />
        <div className="gallery-categories">
          <button
            type="button"
            className={`gallery-cat-btn ${filterCategory === "all" ? "active" : ""}`}
            onClick={() => setFilterCategory("all")}
          >
            Todas
          </button>
          {categories.map((cat) => {
            const count = textures.filter((t) => t.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                className={`gallery-cat-btn ${filterCategory === cat ? "active" : ""}`}
                onClick={() => setFilterCategory(cat)}
              >
                {cat} <span className="count">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">No hay texturas que coincidan con el filtro.</p>
      ) : filterCategory === "all" && !query ? (
        <div className="gallery-categorized">
          {[...grouped.entries()].map(([cat, ts]) => (
            <section key={cat} className="gallery-section">
              <h2>{cat}</h2>
              <div className="gallery-grid">
                {ts.map((t) => (
                  <TextureCard key={t.id} texture={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="gallery-grid">
          {filtered.map((t) => (
            <TextureCard key={t.id} texture={t} />
          ))}
        </div>
      )}
    </main>
  );
}

function TextureCard({ texture }: { texture: Texture }) {
  return (
    <article className="gallery-card">
      <div className="gallery-card-image">
        <img src={texture.imagePath} alt={texture.name} />
      </div>
      <div className="gallery-card-body">
        <h3 className="gallery-card-name">{texture.name}</h3>
        <code className="gallery-card-id">{texture.id}</code>
        <div className="gallery-card-meta">
          <span className="gallery-card-cat">{texture.category}</span>
          <span className="gallery-card-size">
            {texture.width}×{texture.height}px
          </span>
        </div>
        {texture.tags.length > 0 ? (
          <div className="gallery-card-tags">
            {texture.tags.map((t) => (
              <span key={t} className="gallery-tag">
                {t}
              </span>
            ))}
          </div>
        ) : null}
        <a href={texture.imagePath} target="_blank" rel="noreferrer" className="gallery-card-link">
          Ver archivo ↗
        </a>
      </div>
    </article>
  );
}
