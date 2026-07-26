import { connection } from "next/server";
import { Suspense } from "react";
import { loadScenario } from "../actions/scenarios";
import { listAllPieces, listSubdivisions } from "../actions/subdivisions";
import { EditorClient } from "./EditorClient";

type SearchParams = Promise<{ id?: string }>;

function EditorFallback() {
  return (
    <div className="editor">
      <div className="canvas-loading">Cargando editor…</div>
    </div>
  );
}

async function EditorContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { id } = await searchParams;
  const [scenario, subdivisions, allPieces] = await Promise.all([
    id ? loadScenario(id) : Promise.resolve(null),
    listSubdivisions(),
    listAllPieces(),
  ]);

  // The `key` prop forces React to unmount + remount EditorClient whenever the
  // scenario id changes, so all internal state (paintedCells, selected
  // subdivision, current floor, trait menus, etc.) is reset cleanly when
  // navigating between scenarios. Without this, switching from scenario A to
  // B briefly shows A's content until the props update.
  return (
    <EditorClient
      key={scenario?.id ?? "new"}
      initialScenario={
        scenario
          ? {
              id: scenario.id,
              name: scenario.name,
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