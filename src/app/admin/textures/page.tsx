import { Suspense } from "react";
import { connection } from "next/server";
import { ALL_TEXTURES } from "@/assets";
import { PIECE_CATEGORIES } from "@/pieces";
import { TexturesGallery } from "./TexturesGallery";

export const metadata = {
  title: "Galería de texturas — Pathfinder",
};

function GalleryFallback() {
  return (
    <main className="gallery">
      <p className="empty">Cargando texturas…</p>
    </main>
  );
}

async function GalleryContent() {
  await connection();
  return <TexturesGallery textures={ALL_TEXTURES} categories={PIECE_CATEGORIES} />;
}

export default function TexturesPage() {
  return (
    <Suspense fallback={<GalleryFallback />}>
      <GalleryContent />
    </Suspense>
  );
}
