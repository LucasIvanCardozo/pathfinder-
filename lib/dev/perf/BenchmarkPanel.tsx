'use client';

/**
 * Dev-only benchmark panel. Lists the registered scenarios from
 * `benchmark.ts`, runs them with the dispatch callbacks supplied by the
 * editor (paint/pan/drag), and streams status messages back to the panel.
 *
 * Dev-only gate: Next.js inlines `process.env.NODE_ENV` at build time and the
 * unreachable branch is eliminated by the bundler.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { exportScenarios, runScenario, type Scenario } from './benchmark';
import styles from './perf.module.css';
import { telemetry } from './telemetry';
import { usePerfVisibility } from './visibility';

type DispatchPaint = (
  floorId: string,
  subdivisionId: string,
  cells: { gridX: number; gridY: number }[],
  pieceId: string | null,
) => void;

type DispatchPan = (dx: number, dy: number) => void;

type DispatchDrag = (pieceId: string, steps: number) => void;

type GetValidPaintTarget = () => {
  floorId: string;
  subdivisionId: string;
  pieceId: string | null;
  bounds: { w: number; h: number };
} | null;

type Props = {
  dispatchPaint: DispatchPaint;
  dispatchPan: DispatchPan;
  dispatchDrag: DispatchDrag;
  getValidPaintTarget: GetValidPaintTarget;
  getRandomPieceId: () => string | null;
};

export function BenchmarkPanel(props: Props) {
  // Visibility is gated by `?debug=1` / Ctrl+Shift+P (see `usePerfVisibility`).
  // We intentionally do NOT short-circuit on `NODE_ENV === 'production'` so
  // benchmark scenarios can be replayed against the real production bundle
  // via `pnpm start`.
  return <BenchmarkPanelImpl {...props} />;
}

function BenchmarkPanelImpl({
  dispatchPaint,
  dispatchPan,
  dispatchDrag,
  getValidPaintTarget,
  getRandomPieceId,
}: Props) {
  // SSR hydration guard: see PerfHud.tsx for the rationale.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { visible } = usePerfVisibility();
  const scenarios = exportScenarios();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [runningName, setRunningName] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const appendLine = useCallback((line: string) => {
    setStatusLines((prev) => {
      const next = [...prev, line];
      // Cap at 50 lines so the panel does not grow unbounded.
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
  }, []);

  const handleRun = useCallback(
    async (scenario: Scenario) => {
      if (abortRef.current) return;
      const ac = new AbortController();
      abortRef.current = ac;
      setRunningName(scenario.name);
      appendLine(`→ ${scenario.name}`);
      try {
        await runScenario(scenario, {
          telemetry,
          signal: ac.signal,
          emit: appendLine,
          dispatchPaint,
          dispatchPan,
          dispatchDrag,
          getValidPaintTarget,
          getRandomPieceId,
        });
        appendLine(`✓ ${scenario.name}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        appendLine(`✗ ${scenario.name}: ${message}`);
      } finally {
        abortRef.current = null;
        setRunningName(null);
      }
    },
    [appendLine, dispatchDrag, dispatchPaint, dispatchPan, getRandomPieceId, getValidPaintTarget],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    appendLine('⏹ stop requested');
  }, [appendLine]);

  if (!mounted) return null;
  if (!visible) return null;

  const selected = scenarios[selectedIdx];
  const isRunning = runningName !== null;

  return (
    <section className={styles.panel} aria-label="Benchmark panel">
      <header className={styles.panelHeader}>
        <span className={styles.title}>Benchmark</span>
      </header>
      <div className={styles.scenarioList}>
        {scenarios.map((scenario, idx) => (
          <button
            key={scenario.name}
            type="button"
            className={idx === selectedIdx ? styles.scenarioButtonActive : styles.scenarioButton}
            onClick={() => setSelectedIdx(idx)}
            disabled={isRunning}
            title={scenario.description}
          >
            {scenario.name}
          </button>
        ))}
      </div>
      {selected ? (
        <p className={styles.scenarioDescription} title={selected.description}>
          {selected.description}
        </p>
      ) : null}
      <div className={styles.actionsRow}>
        <button
          type="button"
          className={styles.button}
          onClick={() => selected && handleRun(selected)}
          disabled={!selected || isRunning}
        >
          Run scenario
        </button>
        <button type="button" className={styles.button} onClick={handleStop} disabled={!isRunning}>
          Stop
        </button>
      </div>
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Status{runningName ? ` — ${runningName}` : ''}</h4>
        <pre className={styles.status}>
          {statusLines.length === 0 ? '(idle)' : statusLines.join('\n')}
        </pre>
      </section>
    </section>
  );
}
