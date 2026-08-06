import Link from 'next/link';
import { listAllPieces } from '@/lib/server/actions/piece.action';
import { PiecesGallery } from './PiecesGallery';
import styles from './page.module.css';

export default async function PiecesGalleryPage() {
  // listAllPieces is a cached read wrapped by createAction; unwrap the
  // canonical envelope before handing the data to the client component.
  const result = await listAllPieces();
  const pieces = result.success ? result.data : [];
  return (
    <main className={styles.home}>
      <header className={styles.homeHeader}>
        <h1>Pathfinder</h1>
        <p>Battle Map — editor de escenarios</p>
        <nav className={styles.homeNav}>
          <Link href="/" className={styles.homeNavLink}>
            ← Escenarios
          </Link>
        </nav>
      </header>
      <PiecesGallery pieces={pieces} />
    </main>
  );
}
