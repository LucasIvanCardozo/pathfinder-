import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { createBlankScenario, listScenarios } from '@/lib/server/actions/scenario.action';
import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import styles from './page.module.css';

function HomeFallback() {
  return (
    <main className={styles.home}>
      <header className={styles.homeHeader}>
        <h1>Pathfinder</h1>
        <p>Battle Map — editor de escenarios</p>
      </header>
      <Empty>Cargando escenarios…</Empty>
    </main>
  );
}

async function HomeContent() {
  await connection();
  const scenariosResult = await listScenarios();
  // The cached read can fail when the database is down; surface a friendly
  // empty state instead of throwing into the render tree. The action wrapper
  // has already logged the underlying error.
  const scenarios = scenariosResult.success ? scenariosResult.data : [];

  return (
    <>
      <header className={styles.homeHeader}>
        <h1>Pathfinder</h1>
        <p>Battle Map — editor de escenarios</p>
        <nav className={styles.homeNav}>
          <Link href="/admin/pieces" className={styles.homeNavLink}>
            🎨 Galería de texturas
          </Link>
        </nav>
      </header>

      <section className={styles.homeSection}>
        <div className={styles.homeSectionHeader}>
          <h2>Escenarios</h2>
          <form action={createBlankScenario}>
            <Button type="submit" variant="primary">
              + Nuevo
            </Button>
          </form>
        </div>
        {scenarios.length === 0 ? (
          <Empty>No hay escenarios guardados. Creá uno para empezar.</Empty>
        ) : (
          <ul className={styles.scenarioList}>
            {scenarios.map((s) => (
              <li key={s.id} className={styles.scenarioCard}>
                <Link href={`/editor?id=${s.id}`} className={styles.scenarioLink}>
                  <span className={styles.scenarioName}>{s.name}</span>
                  <span className={styles.scenarioMeta}>
                    {s.floorCount} {s.floorCount === 1 ? 'piso' : 'pisos'} · {s.paintedCellCount}{' '}
                    celdas pintadas
                  </span>
                  <span className={styles.scenarioDate}>
                    {new Date(s.updatedAt).toLocaleString('es')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function HomePage() {
  return (
    <main className={styles.home}>
      <Suspense fallback={<HomeFallback />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
