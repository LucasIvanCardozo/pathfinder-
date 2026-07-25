import { Suspense } from "react";
import { connection } from "next/server";
import { loadScenario } from "../actions/scenarios";
import { listSubdivisions, listAllTextures } from "../actions/subdivisions";
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
  const [scenario, subdivisions, allTextures] = await Promise.all([
    id ? loadScenario(id) : Promise.resolve(null),
    listSubdivisions(),
    listAllTextures(),
  ]);

  return (
    <EditorClient
      initialScenario={scenario}
      initialSubdivisions={subdivisions}
      allTextures={allTextures}
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
