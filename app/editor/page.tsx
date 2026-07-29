import { connection } from 'next/server';
import { Suspense } from 'react';
import { loadScenario } from '@/lib/server/actions/scenario.action';
import { listAllPieces, listSubdivisions } from '@/lib/server/actions/subdivision.action';
import styles from './editor.module.css';
import { EditorClient } from './EditorClient';

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
  const { id } = await searchParams;

  // Run all three reads in parallel. Each one comes from a cached Server
  // Action; unwrap the envelope so the client component receives DTOs only.
  const [scenarioResult, subdivisionsResult, allPiecesResult] = await Promise.all([
    id ? loadScenario({ id }) : Promise.resolve(null),
    listSubdivisions(),
    listAllPieces(),
  ]);

  const scenario =
    scenarioResult === null ? null : scenarioResult.success ? scenarioResult.data : null;
  const subdivisions = subdivisionsResult.success ? subdivisionsResult.data : [];
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
            }
          : null
      }
      initialSubdivisions={subdivisions}
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
