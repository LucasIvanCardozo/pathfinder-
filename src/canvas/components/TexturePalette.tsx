"use client";

import type { Texture } from "@/pieces";

type Props = {
  textures: Texture[];
  activeTextureId: string | null;
  onSelect: (textureId: string) => void;
};

/**
 * Vertical palette of textures for the active subdivision. Click to select
 * the texture to paint with.
 */
export function TexturePalette({ textures, activeTextureId, onSelect }: Props) {
  return (
    <div className="texture-palette">
      <h3 className="texture-palette-title">Texturas</h3>
      <div className="texture-palette-grid">
        {textures.map((texture) => (
          <button
            key={texture.id}
            type="button"
            className={`texture-palette-card ${texture.id === activeTextureId ? "active" : ""}`}
            onClick={() => onSelect(texture.id)}
            title={texture.name}
          >
            <img src={texture.imagePath} alt={texture.name} draggable={false} />
            <span>{texture.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
