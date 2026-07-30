'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import {
  applyEraseStroke,
  applyPaintStroke,
  bumpBrushSizeDown,
  bumpBrushSizeUp,
  normalizeBrushSize,
  type PaintTool,
  PaintToolbar,
  PiecePalette,
  SubdivisionTabs,
  useKeyboardShortcuts,
  WeatherOverlay,
  WeatherPanel,
} from '@/canvas';
import { Button } from '@/components/Button';
import { Empty } from '@/components/Empty';
import { SubdivisionManager } from '@/components/SubdivisionManager';
import { usePieceMap, useReload } from '@/hooks';
import { BenchmarkPanel, PerfHud, telemetry } from '@/lib/dev/perf';
import { reorderSubdivisions } from '@/lib/server/actions/subdivision.action';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/shared/constants/map';
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from '@/lib/shared/types';
import { newId } from '@/lib/shared/utils/generateId';
import styles from './editor.module.css';
import { useFloorHeuristics } from './hooks/use-floor-heuristics';
import { useScenarioAutosave } from './hooks/use-scenario-autosave';
import { useTraitMenu } from './hooks/use-trait-menu';
import { useWeatherSession } from './hooks/use-weather-session';
import { useZoomControl } from './hooks/use-zoom-control';

const FloorStack = dynamic(() => import('@/canvas/konva').then((m) => m.FloorStack), {
  ssr: false,
  loading: () => <div className={styles.canvasLoading}>Cargando canvas…</div>,
});

type InitialScenario = {
  id: string;
  name: string;
  baseCellSize: number;
  width: number;
  height: number;
  floors: Floor[];
  activeFloorId: string;
  paintedCells: PaintedCell[];
};

type Props = {
  initialScenario: InitialScenario | null;
  initialSubdivisions: SubdivisionConfig[];
  allPieces: Piece[];
};

export function EditorClient({ initialScenario, initialSubdivisions, allPieces }: Props) {
  const router = useRouter();
  const { startReload } = useReload();
  const [scenarioId, setScenarioId] = useState<string | null>(initialScenario?.id ?? null);
  const [scenarioName, setScenarioName] = useState(initialScenario?.name ?? '');
  const [floors, setFloors] = useState<Floor[]>(initialScenario?.floors ?? []);
  const [activeFloorId, setActiveFloorId] = useState(initialScenario?.activeFloorId ?? '');
  const [subdivisions, setSubdivisions] = useState<SubdivisionConfig[]>(initialSubdivisions);
  const [paintedCells, setPaintedCells] = useState<PaintedCell[]>(
    initialScenario?.paintedCells ?? [],
  );
  const [activeSubdivisionId, setActiveSubdivisionId] = useState(initialSubdivisions[0]?.id ?? '');
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const [tool, setTool] = useState<PaintTool>('paint');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [isManaging, setIsManaging] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Memoize so FloorCanvas memo comparator sees a stable reference.
  // Before this fix `mapDims` was a fresh object every render, which
  // invalidated every FloorCanvas on every paint.
  const mapDims = useMemo(
    () => ({
      baseCellSize: initialScenario?.baseCellSize ?? 64,
      width: initialScenario?.width ?? 100,
      height: initialScenario?.height ?? 300,
    }),
    [initialScenario?.baseCellSize, initialScenario?.width, initialScenario?.height],
  );
  const { zoom, zoomIn, zoomOut } = useZoomControl();
  const activeSubdivision = subdivisions.find((s) => s.id === activeSubdivisionId);
  // Pieces are global — every piece is paintable in any subdivision cell.
  const activePieces = allPieces;

  // `pieceById` is built from `allPieces` (full catalogue). FloorCanvas
  // receives the same `allPieces` directly and builds its own `usePieceMap`
  // internally. Previously we filtered upstream to a derived
  // `allUsedPieces`, but that filter ran every paint and broke the
  // FloorCanvas `React.memo` comparator. FloorCanvas only needs the
  // `pieceId → piece` lookup, which it builds itself.
  const pieceById = usePieceMap(allPieces);

  const markDirty = useCallback(() => setIsDirty(true), []);
  const { isSaving, autosaveStatus, savedAt, save } = useScenarioAutosave({
    scenarioName,
    scenarioId,
    mapDims,
    floors,
    paintedCells,
    isDirty,
    onSaved: useCallback(
      (savedId: string) => {
        setScenarioId(savedId);
        router.replace(`/editor?id=${savedId}`);
        setIsDirty(false);
      },
      [router],
    ),
  });
  const {
    activeFloorIndex,
    activeFloor,
    handleAddFloorAbove,
    handleAddFloorBelow,
    handleFloorUp,
    handleFloorDown,
  } = useFloorHeuristics({
    floors,
    activeFloorId,
    setActiveFloorId,
    setFloors,
    markDirty,
  });
  const { weatherState, setWeatherState, thunderAt } = useWeatherSession();
  const traitMenu = useTraitMenu({ paintedCells, setPaintedCells, pieceById, markDirty });

  const handlePaint = useCallback(
    (
      floorId: string,
      subdivisionId: string,
      cells: { gridX: number; gridY: number }[],
      pieceId: string | null,
    ) => {
      if (cells.length === 0) return;
      markDirty();

      if (tool === 'erase') {
        telemetry.recordEvent('erase');
        setPaintedCells((prev) =>
          applyEraseStroke({ stroke: { floorId, subdivisionId, cells }, paintedCells: prev }),
        );
        return;
      }

      if (!pieceId) return;

      telemetry.recordEvent('paint');
      setPaintedCells((prev) =>
        applyPaintStroke({
          stroke: { floorId, subdivisionId, cells },
          pieceId,
          pieceById,
          paintedCells: prev,
          generateId: () => newId('cell'),
        }),
      );
    },
    [tool, markDirty, pieceById],
  );

  const handleSubdivisionChange = (id: string) => {
    // Pieces are global — the active piece persists across subdivision
    // changes so the brush keeps painting the same piece after switching.
    setActiveSubdivisionId(id);
  };

  const handleReorder = useCallback(
    async (fromId: string, toId: string, side: 'left' | 'right') => {
      if (fromId === toId) return;
      const fromIdx = subdivisions.findIndex((s) => s.id === fromId);
      const toIdx = subdivisions.findIndex((s) => s.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;

      const moved = subdivisions[fromIdx]!;
      const without = subdivisions.filter((_, i) => i !== fromIdx);
      const newToIdx = without.findIndex((s) => s.id === toId);
      const insertAt = side === 'left' ? newToIdx : newToIdx + 1;
      without.splice(insertAt, 0, moved);

      const renumbered = without.map((s, i) => ({ ...s, order: i }));
      setSubdivisions(renumbered);
      markDirty();
      const result = await reorderSubdivisions(
        renumbered.map((s) => ({ id: s.id, order: s.order })),
      );
      // Re-validate from server: action returns bare void on success;
      // silent failure would leave local state desynced. startReload
      // triggers a silent RSC refresh via router.refresh() inside
      // startTransition (no loading flash).
      if (result.success) startReload();
    },
    [subdivisions, markDirty, startReload],
  );

  useKeyboardShortcuts([
    { key: 'b', handler: () => setTool('paint') },
    { key: 'e', handler: () => setTool('erase') },
    { key: '[', handler: () => setBrushSize((s) => bumpBrushSizeDown(normalizeBrushSize(s))) },
    { key: ']', handler: () => setBrushSize((s) => bumpBrushSizeUp(normalizeBrushSize(s))) },
    {
      key: 's',
      ctrl: true,
      handler: () => {
        if (isSaving) return;
        save(false);
      },
    },
    {
      key: 'Escape',
      handler: traitMenu.close,
    },
    ...subdivisions.map((sub, i) => ({
      key: String(i + 1),
      handler: () => handleSubdivisionChange(sub.id),
    })),
    { key: 'ArrowUp', shift: true, handler: handleFloorUp },
    { key: 'ArrowDown', shift: true, handler: handleFloorDown },
  ]);

  const handleCloseManager = async () => {
    setIsManaging(false);
    // Dynamic import keeps the action bundle out of the initial editor
    // chunk — the manager only needs it when the user opens the modal.
    // The action returns the canonical envelope; unwrap here so the rest
    // of the file deals with DTOs only.
    const result = await import('@/lib/server/actions/subdivision.action').then((m) =>
      m.listSubdivisions(),
    );
    const fresh = result.success ? result.data : [];
    setSubdivisions(fresh);
    if (!fresh.find((s) => s.id === activeSubdivisionId)) {
      setActiveSubdivisionId(fresh[0]?.id ?? '');
    }
  };

  const handleToolChange = (newTool: PaintTool) => {
    setTool(newTool);
  };

  const handleBrushSizeChange = (size: number) => {
    setBrushSize(normalizeBrushSize(size));
  };

  const handleClearAll = () => {
    if (!confirm('¿Borrar TODO el scenario (pintadas de todos los pisos)? No se puede deshacer.'))
      return;
    setPaintedCells([]);
    markDirty();
  };

  const handleClearFloor = () => {
    if (
      !confirm(`¿Borrar todas las celdas pintadas de "${activeFloor.name}"? No se puede deshacer.`)
    )
      return;
    const fid = activeFloor.id;
    setPaintedCells((prev) => prev.filter((c) => c.floorId !== fid));
    markDirty();
  };

  const handleClearSubdivision = () => {
    if (!activeSubdivision) return;
    if (
      !confirm(
        `¿Borrar todas las celdas pintadas de "${activeSubdivision.name}" en "${activeFloor.name}"? No se puede deshacer.`,
      )
    )
      return;
    const fid = activeFloor.id;
    const sid = activeSubdivisionId;
    setPaintedCells((prev) => prev.filter((c) => !(c.floorId === fid && c.subdivisionId === sid)));
    markDirty();
  };

  const paintedInFloor = paintedCells.filter((c) => c.floorId === activeFloorId).length;

  // Dev-only stubs for the benchmark harness. Real pan/drag dispatches land in
  // the viewport / piece hooks; for now we just record the event so the
  // benchmark counter reflects the workload.
  const benchmarkDispatchPan = useCallback((dx: number, dy: number) => {
    telemetry.recordEvent('pan');
    void dx;
    void dy;
  }, []);
  const benchmarkDispatchDrag = useCallback((pieceId: string, steps: number) => {
    telemetry.recordEvent('drag');
    void pieceId;
    void steps;
  }, []);
  const benchmarkGetValidPaintTarget = useCallback(() => {
    if (!activeSubdivisionId) return null;
    return {
      floorId: activeFloorId,
      subdivisionId: activeSubdivisionId,
      pieceId: activePieceId,
      bounds: { w: mapDims.width, h: mapDims.height },
    };
  }, [activeFloorId, activeSubdivisionId, activePieceId, mapDims.height, mapDims.width]);
  const benchmarkGetRandomPieceId = useCallback(
    () => activePieceId ?? allPieces[0]?.id ?? null,
    [activePieceId, allPieces],
  );

  return (
    <div className={styles.editor}>
      <aside className={styles.paintSidebar}>
        <Link href="/" className={styles.backLink}>
          ← Escenarios
        </Link>
        <PaintToolbar
          tool={tool}
          onChange={handleToolChange}
          brushSize={brushSize}
          onBrushSizeChange={handleBrushSizeChange}
        />
        <Button type="button" onClick={() => setIsManaging(true)}>
          ⚙ Administrar subdivisions
        </Button>
        <div className={styles.dangerZone}>
          <Button
            type="button"
            size="mini"
            variant="danger"
            onClick={handleClearAll}
            disabled={paintedCells.length === 0}
            title="Borrar TODO el scenario"
          >
            🗑 Todo
          </Button>
          <Button
            type="button"
            size="mini"
            variant="danger"
            onClick={handleClearFloor}
            disabled={paintedInFloor === 0}
            title={`Borrar todo "${activeFloor.name}"`}
          >
            🗑 Piso
          </Button>
          <Button
            type="button"
            size="mini"
            variant="danger"
            onClick={handleClearSubdivision}
            disabled={
              !activeSubdivision ||
              paintedCells.filter(
                (c) => c.floorId === activeFloorId && c.subdivisionId === activeSubdivisionId,
              ).length === 0
            }
            title={
              activeSubdivision
                ? `Borrar "${activeSubdivision.name}" de "${activeFloor.name}"`
                : 'Sin subcapa activa'
            }
          >
            🗑 Subcapa
          </Button>
        </div>
        {activeSubdivision ? (
          <PiecePalette
            pieces={activePieces}
            activePieceId={activePieceId}
            onSelect={setActivePieceId}
          />
        ) : null}
        <WeatherPanel onChange={setWeatherState} initial={weatherState} />
      </aside>

      <main className={styles.canvasArea}>
        <header className={styles.canvasHeader}>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            className={styles.scenarioNameInput}
            placeholder="Nombre del escenario"
          />
          <div className={styles.floorSwitcher}>
            <Button
              type="button"
              size="mini"
              onClick={handleAddFloorBelow}
              title="Agregar subsuelo (debajo del actual)"
            >
              ↓+
            </Button>
            <Button
              type="button"
              size="mini"
              onClick={handleFloorDown}
              disabled={activeFloorIndex <= 0}
              title="Bajar de piso"
            >
              ↓
            </Button>
            <span className={styles.floorCurrent} title={activeFloor.name}>
              {activeFloor.name}
            </span>
            <Button
              type="button"
              size="mini"
              onClick={handleFloorUp}
              disabled={activeFloorIndex < 0 || activeFloorIndex >= floors.length - 1}
              title="Subir de piso"
            >
              ↑
            </Button>
            <Button
              type="button"
              size="mini"
              onClick={handleAddFloorAbove}
              title="Agregar piso arriba del actual"
            >
              +↑
            </Button>
            <span className={styles.floorSwitcherDivider} aria-hidden="true" />
          </div>

          <div className={styles.zoomControls}>
            <Button
              type="button"
              size="mini"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              title="Reducir zoom"
            >
              −
            </Button>
            <span className={styles.zoomDisplay} aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              size="mini"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              title="Aumentar zoom"
            >
              +
            </Button>
          </div>

          <span
            className={styles.autosaveStatus}
            data-status={autosaveStatus}
            title="Autoguardado cada 1 min"
          >
            {autosaveStatus === 'saving' && '⟳ Guardando…'}
            {autosaveStatus === 'saved' && savedAt && `✓ Guardado ${savedAt}`}
            {autosaveStatus === 'error' && '✗ Error al guardar'}
            {autosaveStatus === 'idle' && (savedAt ? `Guardado ${savedAt}` : '○')}
          </span>
          <Button type="button" variant="primary" onClick={() => save(false)} disabled={isSaving}>
            {isSaving ? 'Guardando…' : scenarioId ? 'Guardar' : 'Crear'}
          </Button>
        </header>

        {subdivisions.length > 0 ? (
          <SubdivisionTabs
            subdivisions={subdivisions}
            activeId={activeSubdivisionId}
            onChange={handleSubdivisionChange}
            onReorder={handleReorder}
          />
        ) : (
          <Empty>
            No hay subdivisions.{' '}
            <Button type="button" onClick={() => setIsManaging(true)}>
              Crear la primera
            </Button>
          </Empty>
        )}

        <FloorStack
          floors={floors}
          activeFloorId={activeFloorId}
          mapDims={mapDims}
          zoom={zoom}
          subdivisions={subdivisions}
          paintedCells={paintedCells}
          pieces={allPieces}
          activeSubdivisionId={activeSubdivisionId}
          activePieceId={activePieceId}
          tool={tool}
          brushSize={brushSize}
          onPaint={handlePaint}
          onOpenTraitMenu={traitMenu.open}
          overlay={<WeatherOverlay weatherId={weatherState.weatherId} thunderAt={thunderAt} />}
        />
      </main>

      <SubdivisionManager
        isOpen={isManaging}
        onClose={handleCloseManager}
        subdivisions={subdivisions}
      />

      <PerfHud />
      <BenchmarkPanel
        dispatchPaint={handlePaint}
        dispatchPan={benchmarkDispatchPan}
        dispatchDrag={benchmarkDispatchDrag}
        getValidPaintTarget={benchmarkGetValidPaintTarget}
        getRandomPieceId={benchmarkGetRandomPieceId}
      />

      {traitMenu.render}
    </div>
  );
}
