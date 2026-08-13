import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { listAllPieces } from '@/lib/server/actions/piece.action';
import { loadScenario } from '@/lib/server/actions/scenario.action';
import { isUnlocked } from '@/lib/server/auth/session';
import { DEFAULT_FLOOR_NAMES, DEFAULT_MAP_DIMS } from '@/lib/shared/constants';
import { newId } from '@/lib/shared/utils/generateId';
import { EditorClient } from './EditorClient';
import styles from './editor.module.css';

type SearchParams = Promise<{ id?: string; demo?: string }>;

/**
 * Synthetic payload for `/editor?demo=1`. Mirrors the three floors seeded by
 * `scenarioUseCases.createBlank` (Subsuelo 1 / Planta Baja / Piso 1) so the
 * demo editor opens looking identical to a freshly-created live scenario —
 * but the `id` is a sentinel and no DB row is ever written. `activeFloorId`
 * is "Planta Baja" to match `findByIdWithFloors`'s resolution rule.
 */
function buildDemoInitialScenario() {
  const floors = DEFAULT_FLOOR_NAMES.map((name) => ({ id: newId('floor'), name }));
  const plantaBaja = floors[1];
  if (!plantaBaja)
    throw new Error('DEFAULT_FLOOR_NAMES is empty — check lib/shared/constants/floors.ts');
  return {
    id: '__demo__',
    name: '',
    ...DEFAULT_MAP_DIMS,
    floors,
    activeFloorId: plantaBaja.id,
    paintedCells: [],
    effects: [],
    combat: null,
  };
}

function EditorFallback() {
  return (
    <div className={styles.editor}>
      <div className={styles.canvasLoading}>Cargando editor…</div>
    </div>
  );
}

async function EditorContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { id, demo } = await searchParams;
  const isDemo = demo === '1';
  // Demo bypasses the session cookie gate so visitors can poke the canvas
  // without a password. The autosave hook then short-circuits every write so
  // nothing lands in the DB; the editor surface already hides the save
  // controls in that mode.
  if (!isDemo && !(await isUnlocked())) {
    redirect('/');
  }

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

  // Demo mode seeds the same three floors as `createBlankScenario` so the
  // canvas opens usable. Live mode without an `id` keeps `null` — the
  // editor then waits for the user to click "Crear" in the save button.
  const initialScenario = scenario
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
    : isDemo
      ? buildDemoInitialScenario()
      : null;

  // The `key` prop forces React to unmount + remount EditorClient whenever
  // the scenario id changes, so all internal state (paintedCells, selected
  // subdivision, current floor, trait menus, etc.) is reset cleanly when
  // navigating between scenarios. Without this, switching from scenario A
  // to B briefly shows A's content until the props update. The demo branch
  // uses a dedicated key so flipping between demo and a real scenario (or
  // vice versa) also forces a clean remount; real ids are prefixed with
  // `scenario_`, so `"demo"` never collides.

  return (
    <EditorClient
      key={isDemo ? 'demo' : (scenario?.id ?? 'new')}
      isDemo={isDemo}
      initialScenario={initialScenario}
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
