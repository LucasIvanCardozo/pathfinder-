'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  applyEraseStroke,
  applyPaintStroke,
  PaintToolbar,
  PiecePalette,
  SubdivisionTabs,
  useKeyboardShortcuts,
  WeatherOverlay,
  WeatherPanel,
  type BrushShape,
  type PaintTool,
} from '@/canvas';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { usePieceMap } from '@/hooks';
import { telemetry } from '@/dev/perf/telemetry';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/shared/constants/map';
import { DEFAULT_BRUSH_SHAPE, SUBDIVISIONS } from '@/lib/shared/constants';
import { normalizeBrushSize } from '@/canvas/tools';
import type { Floor, PaintedCell, Piece } from '@/lib/shared/types';
import { newId } from '@/lib/shared/utils/generateId';
import styles from './editor.module.css';
import { buildEditorShortcuts } from './shortcuts';
import { useClearHandlers } from './hooks/use-clear-handlers';
import { useFloorHeuristics } from './hooks/use-floor-heuristics';
import { useOpsBuffer } from './hooks/use-ops-buffer';
import { usePaintStrokeDiff } from './hooks/use-paint-stroke-diff';
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
  allPieces: Piece[];
};

/**
 * Editor root. Owns scenario state (floors, cells, brush/paint settings) and
 * composes the per-feature hooks (ops buffer, autosave, viewport, weather,
 * floor heuristics, trait menu, shortcut bindings). Layout lives entirely
 * here; behaviour is delegated.
 */
export function EditorClient({ initialScenario, allPieces }: Props) {
  const router = useRouter();
  const [scenarioId, setScenarioId] = useState<string | null>(initialScenario?.id ?? null);
  const [scenarioName, setScenarioName] = useState(initialScenario?.name ?? '');
  const [baselineVersion, setBaselineVersion] = useState<string | null>(null);
  const [floors, setFloors] = useState<Floor[]>(initialScenario?.floors ?? []);
  const [activeFloorId, setActiveFloorId] = useState(initialScenario?.activeFloorId ?? '');
  const subdivisions = SUBDIVISIONS;
  const [paintedCells, setPaintedCells] = useState<PaintedCell[]>(
    initialScenario?.paintedCells ?? [],
  );
  const [activeSubdivisionId, setActiveSubdivisionId] = useState(SUBDIVISIONS[0]?.id ?? '');
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const [tool, setTool] = useState<PaintTool>('paint');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [brushShape, setBrushShape] = useState<BrushShape>(DEFAULT_BRUSH_SHAPE);
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Memoized so the FloorCanvas memo comparator sees a stable reference.
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
  const activePieces = allPieces;
  const pieceById = usePieceMap(allPieces);
  const { computeStrokeDiff } = usePaintStrokeDiff();

  const markDirty = useCallback(() => setIsDirty(true), []);
  const opsBuffer = useOpsBuffer();

  // Mirror `paintedCells` in a ref so `handlePaint` can read the current
  // cells without listing them in its useCallback deps (see `use-ops-buffer`
  // for the rationale on stability).
  const paintedCellsRef = useRef(paintedCells);
  paintedCellsRef.current = paintedCells;
  const { pushPaint, pushErase } = opsBuffer;

  const { isSaving, autosaveStatus, savedAt, save } = useScenarioAutosave({
    scenarioName,
    scenarioId,
    mapDims,
    floors,
    paintedCells,
    isDirty,
    opsBuffer,
    baselineVersion,
    onSaved: useCallback(
      (savedId: string, newVersion: string) => {
        setScenarioId(savedId);
        setBaselineVersion(newVersion);
        setIsDirty(false);
        router.replace(`/editor?id=${savedId}`);
        router.refresh();
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
    pushAddFloor: opsBuffer.pushAddFloor,
  });
  const { weatherState, setWeatherState, thunderAt } = useWeatherSession();
  const traitMenu = useTraitMenu({
    paintedCells,
    setPaintedCells,
    pieceById,
    markDirty,
    pushEntityState: opsBuffer.pushEntityState,
  });

  const handleSubdivisionChange = (id: string) => setActiveSubdivisionId(id);

  const handlePaint = useCallback(
    (
      floorId: string,
      subdivisionId: string,
      cells: { gridX: number; gridY: number }[],
      pieceId: string | null,
    ) => {
      if (cells.length === 0) return;
      markDirty();

      const stroke = { floorId, subdivisionId, cells };
      const currentPaintedCells = paintedCellsRef.current;

      if (tool === 'erase') {
        telemetry.recordEvent('erase');
        const next = applyEraseStroke({ stroke, paintedCells: currentPaintedCells });
        // Find which prev cells landed in the stroke but were removed —
        // these are the ids the server must delete. The two-key lookup is
        // necessary so cells from other floors sharing the same (gridX,
        // gridY) don't collide (see `use-paint-stroke-diff` for context).
        const existingKey = (c: {
          floorId: string;
          subdivisionId: string;
          gridX: number;
          gridY: number;
        }) => `${c.floorId}|${c.subdivisionId}|${c.gridX}|${c.gridY}`;
        const strokeKey = (gx: number, gy: number) =>
          `${floorId}|${subdivisionId}|${gx}|${gy}`;
        const prevByKey = new Map(
          currentPaintedCells.map((c) => [existingKey(c), c]),
        );
        const removedIds: string[] = [];
        for (const cell of cells) {
          const existing = prevByKey.get(strokeKey(cell.gridX, cell.gridY));
          if (existing) removedIds.push(existing.id);
        }
        if (removedIds.length > 0) pushErase(removedIds);
        setPaintedCells(next);
        return;
      }

      if (!pieceId) return;

      telemetry.recordEvent('paint');
      const next = applyPaintStroke({
        stroke,
        pieceId,
        pieceById,
        paintedCells: currentPaintedCells,
        generateId: () => newId('cell'),
      });

      const { eraseIds, paintCells } = computeStrokeDiff(
        currentPaintedCells,
        next,
        stroke,
      );
      if (eraseIds.length > 0) pushErase(eraseIds);
      if (paintCells.length > 0) pushPaint(floorId, subdivisionId, paintCells);

      setPaintedCells(next);
    },
    [tool, markDirty, pieceById, pushPaint, pushErase, computeStrokeDiff],
  );

  const handleToolChange = (newTool: PaintTool) => setTool(newTool);
  const handleBrushSizeChange = (size: number) => setBrushSize(normalizeBrushSize(size));

  const { handleClearAll, handleClearFloor, handleClearSubdivision } = useClearHandlers({
    opsBuffer,
    activeFloor,
    activeSubdivisionId,
    activeSubdivisionName: activeSubdivision?.name,
    markDirty,
    setPaintedCells,
  });

  useKeyboardShortcuts(
    buildEditorShortcuts({
      setTool,
      setBrushSize,
      setBrushShape,
      save: () => {
        if (isSaving) return;
        save(false);
      },
      traitMenu,
      setIsCanvasExpanded,
      handleSubdivisionChange,
      subdivisions,
      handleFloorUp,
      handleFloorDown,
      zoomIn,
      zoomOut,
    }),
  );

  const paintedInFloor = paintedCells.filter((c) => c.floorId === activeFloorId).length;

  return (
    <div className={`${styles.editor} ${isCanvasExpanded ? styles.expanded : ''}`}>
      <aside className={styles.paintSidebar}>
        <Link href="/" className={styles.backLink}>
          ← Escenarios
        </Link>
        <PaintToolbar
          tool={tool}
          onChange={handleToolChange}
          brushSize={brushSize}
          onBrushSizeChange={handleBrushSizeChange}
          brushShape={brushShape}
          onBrushShapeChange={setBrushShape}
        />
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

      <main className={`${styles.canvasArea} ${isCanvasExpanded ? styles.expanded : ''}`}>
        <header className={styles.canvasHeader}>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => {
              const next = e.target.value;
              setScenarioName(next);
              opsBuffer.pushScenarioName(next);
            }}
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
            {autosaveStatus === 'saving' && (
              <>
                <Spinner size={12} label="Guardando" />
                Guardando…
              </>
            )}
            {autosaveStatus === 'saved' && savedAt && `✓ Guardado ${savedAt}`}
            {autosaveStatus === 'timeout' && (
              <>
                <Spinner size={12} label="Timeout" />
                Timeout — reintentá
              </>
            )}
            {autosaveStatus === 'error' && '✗ Error al guardar'}
            {autosaveStatus === 'idle' && (savedAt ? `Guardado ${savedAt}` : '○')}
          </span>
          <Button
            type="button"
            variant="default"
            size="mini"
            onClick={() => setIsCanvasExpanded((expanded) => !expanded)}
            title={
              isCanvasExpanded
                ? 'Salir del modo expandido (Esc)'
                : 'Expandir canvas a pantalla completa (F11)'
            }
            aria-pressed={isCanvasExpanded}
          >
            {isCanvasExpanded ? '⤢ Comprimir' : '⤡ Expandir'}
          </Button>
          <Button type="button" variant="primary" onClick={() => save(false)} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner size={14} label="Guardando" />
                Guardando…
              </>
            ) : (
              scenarioId ? 'Guardar' : 'Crear'
            )}
          </Button>
        </header>

        {!isCanvasExpanded && (
          <SubdivisionTabs
            subdivisions={subdivisions}
            activeId={activeSubdivisionId}
            onChange={handleSubdivisionChange}
          />
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
          brushShape={brushShape}
          onPaint={handlePaint}
          onOpenTraitMenu={traitMenu.open}
          overlay={<WeatherOverlay weatherId={weatherState.weatherId} thunderAt={thunderAt} />}
        />
      </main>

      {isCanvasExpanded && (
        <button
          type="button"
          className={styles.exitExpandedButton}
          onClick={() => setIsCanvasExpanded(false)}
          title="Salir del modo expandido (Esc)"
        >
          ⤢ Comprimir
        </button>
      )}

      {traitMenu.render}
    </div>
  );
}
