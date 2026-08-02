import { connection } from 'next/server';
import { Suspense } from 'react';
import { Empty } from '@/components/Empty';
import { listScenarios } from '@/lib/server/actions/scenario.action';
import { isUnlocked } from '@/lib/server/auth/session';
import { HomeClient, type ScenarioSummary } from './HomeClient';
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
  const unlocked = await isUnlocked();
  const result = await listScenarios();
  // The cached read can fail when the database is down; surface a friendly
  // empty state instead of throwing into the render tree. The action wrapper
  // has already logged the underlying error.
  const scenarios = (result.success ? result.data : []) as unknown as ScenarioSummary[];

  return <HomeClient scenarios={scenarios} unlocked={unlocked} />;
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
