import Link from "next/link";
import { listAllPieces } from "@/lib/server/actions/subdivision.action";
import { PiecesGallery } from "./PiecesGallery";

export default async function PiecesGalleryPage() {
  // listAllPieces is a cached read wrapped by createAction; unwrap the
  // canonical envelope before handing the data to the client component.
  const result = await listAllPieces();
  const pieces = result.success ? result.data : [];
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