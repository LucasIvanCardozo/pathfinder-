import Link from "next/link";
import { listAllPieces } from "../../actions/subdivisions";
import { PiecesGallery } from "./PiecesGallery";

export default async function PiecesGalleryPage() {
  const pieces = await listAllPieces();
  return (
    <main className="home">
      <header className="home-header">
        <h1>Pathfinder</h1>
        <p>Battle Map — editor de escenarios</p>
        <nav className="home-nav">
          <Link href="/" className="home-nav-link">
            ← Escenarios
          </Link>
        </nav>
      </header>
      <PiecesGallery pieces={pieces} />
    </main>
  );
}