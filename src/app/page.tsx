import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { createBlankScenario, listScenarios } from "./actions/scenarios";
import "./home.css";

function HomeFallback() {
  return (
    <main className="home">
      <header className="home-header">
        <h1>Pathfinder</h1>
        <p>Battle Map — editor de escenarios</p>
      </header>
      <p className="empty">Cargando escenarios…</p>
    </main>
  );
}

async function HomeContent() {
  await connection();
  const scenarios = await listScenarios();

  return (
    <>
      <header className="home-header">
        <h1>Pathfinder</h1>
        <p>Battle Map — editor de escenarios</p>
        <nav className="home-nav">
          <Link href="/admin/pieces" className="home-nav-link">
            🎨 Galería de texturas
          </Link>
        </nav>
      </header>

      <section className="home-section">
        <div className="home-section-header">
          <h2>Escenarios</h2>
          <form action={createBlankScenario}>
            <button type="submit" className="button primary">
              + Nuevo
            </button>
          </form>
        </div>
        {scenarios.length === 0 ? (
          <p className="empty">No hay escenarios guardados. Creá uno para empezar.</p>
        ) : (
          <ul className="scenario-list">
            {scenarios.map((s) => (
              <li key={s.id} className="scenario-card">
                <Link href={`/editor?id=${s.id}`} className="scenario-link">
                  <span className="scenario-name">{s.name}</span>
                  <span className="scenario-meta">
                    {s.floorCount} {s.floorCount === 1 ? "piso" : "pisos"} · {s.paintedCellCount}{" "}
                    celdas pintadas
                  </span>
                  <span className="scenario-date">
                    {new Date(s.updatedAt).toLocaleString("es")}
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
    <main className="home">
      <Suspense fallback={<HomeFallback />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}
