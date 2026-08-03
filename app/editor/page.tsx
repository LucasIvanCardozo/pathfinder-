import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { listAllPieces } from '@/lib/server/actions/piece.action';
import { loadScenario } from '@/lib/server/actions/scenario.action';
import { isUnlocked } from '@/lib/server/auth/session';
import { EditorClient } from './EditorClient';
import styles from './editor.module.css';

type SearchParams = Promise<{ id?: string }>;

function EditorFallback() {
  return (
    <div className={styles.editor}>
      <div className={styles.canvasLoading}>Cargando editor…</div>
    </div>
  );
}

async function EditorContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  // Soft gate: the home page is public, but the editor requires the session
  // cookie. Without it, bounce back to the home page so the user can unlock
  // through the password prompt.
  if (!(await isUnlocked())) {
    redirect('/');
  }
  const { id } = await searchParams;

  // Run the scenario + pieces reads in parallel. Subdivisions are an immutable
  // hardcoded constant (see `SUBDIVISIONS`), so they don't need a fetch — the
  // import is enough.
  const [scenarioResult, allPiecesResult] = await Promise.all([
    id ? loadScenario({ id }) : Promise.resolve(null),
    listAllPieces(),
  ]);

  const scenario =
    scenarioResult === null ? null : scenarioResult.success ? scenarioResult.data : null;
  const allPieces = allPiecesResult.success ? allPiecesResult.data : [];

  // The `key` prop forces React to unmount + remount EditorClient whenever the
  // scenario id changes, so all internal state (paintedCells, selected
  // subdivision, current floor, trait menus, etc.) is reset cleanly when
  // navigating between scenarios. Without this, switching from scenario A to
  // B briefly shows A's content until the props update.
  return (
    <EditorClient
      key={scenario?.id ?? 'new'}
      initialScenario={
        scenario
          ? {
              id: scenario.id,
              name: scenario.name,
              baseCellSize: scenario.baseCellSize,
              width: scenario.width,
              height: scenario.height,
              floors: scenario.floors,
              activeFloorId: scenario.activeFloorId,
              paintedCells: scenario.paintedCells,
              effects: scenario.effects,
              combat: scenario.combat,
            }
          : null
      }
      allPieces={allPieces}
    />
  );
}

export default function EditorPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<EditorFallback />}>
      <EditorContent searchParams={searchParams} />
    </Suspense>
  );
}
