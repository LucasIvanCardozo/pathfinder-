'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCloud, faKeyboard, faTrash } from '@fortawesome/free-solid-svg-icons';
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
import { FloatingPanel } from '@/components/FloatingPanel';
import { Popover } from '@/components/Popover';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { Spinner } from '@/components/Spinner';
import { usePieceMap } from '@/hooks';
import { telemetry } from '@/dev/perf/telemetry';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/shared/constants/map';
import { DARKNESS_PIECE_ID, DEFAULT_BRUSH_SHAPE, SUBDIVISIONS } from '@/lib/shared/constants';
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
  const [darknessMode, setDarknessMode] = useState<'apply' | 'erase'>('apply');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [brushShape, setBrushShape] = useState<BrushShape>(DEFAULT_BRUSH_SHAPE);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [showBrushPreview, setShowBrushPreview] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);

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

      // Darkness paint path. Bypasses the normal paint/erase reducers and
      // diff machinery — darkness cells never replace an existing cell
      // (the sentinel pieceId is unique to the obscured subdivision) and
      // they have no entityState. The append-only shape means we don't
      // need `computeStrokeDiff` here.
      if (
        tool === 'darkness' &&
        subdivisionId === 'obscured' &&
        pieceId === DARKNESS_PIECE_ID
      ) {
        telemetry.recordEvent('paint');
        const newCells = cells.map((c) => ({
          id: newId('cell'),
          floorId,
          subdivisionId: 'obscured',
          gridX: c.gridX,
          gridY: c.gridY,
          pieceId: DARKNESS_PIECE_ID,
        }));
        pushPaint(floorId, 'obscured', newCells);
        setPaintedCells((prev) => [...prev, ...newCells]);
        return;
      }

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

  const handleToolChange = (newTool: PaintTool) => {
    if (newTool === 'darkness') {
      if (tool === 'darkness') {
        // Already active: toggle the internal mode.
        setDarknessMode((mode) => (mode === 'apply' ? 'erase' : 'apply'));
        return;
      }
      // Coming from a different tool: enter darkness in apply mode.
      setTool('darkness');
      setDarknessMode('apply');
      return;
    }
    // Any non-darkness tool resets the mode before darkness is selected again.
    setTool(newTool);
    setDarknessMode('apply');
  };
  const handleBrushSizeChange = (size: number) => setBrushSize(normalizeBrushSize(size));

  const handleDarknessErase = useCallback(
    (floorId: string, cells: { gridX: number; gridY: number }[]) => {
      if (cells.length === 0) return;
      const current = paintedCellsRef.current;
      const byKey = new Map(
        current.map((c) => [
          `${c.floorId}|${c.subdivisionId}|${c.gridX}|${c.gridY}`,
          c,
        ]),
      );
      const removedIds: string[] = [];
      for (const cell of cells) {
        const key = `${floorId}|obscured|${cell.gridX}|${cell.gridY}`;
        const found = byKey.get(key);
        if (found) removedIds.push(found.id);
      }
      if (removedIds.length === 0) return;
      markDirty();
      telemetry.recordEvent('erase');
      pushErase(removedIds);
      setPaintedCells((prev) => prev.filter((c) => !removedIds.includes(c.id)));
    },
    [markDirty, pushErase],
  );

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
      setTool: handleToolChange,
      setBrushSize,
      setBrushShape,
      setShowBrushPreview,
      setShowShortcuts,
      save: () => {
        if (isSaving) return;
        save(false);
      },
      traitMenu,
      setChromeVisible,
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
    <div className={styles.editor} data-chrome-visible={chromeVisible}>
      <FloatingPanel
        as="aside"
        className={styles.floatingAside}
        ariaLabel="Herramientas del editor"
        inert={!chromeVisible}
      >
        <Link href="/" className={styles.backLink}>
          ← Escenarios
        </Link>
        <PaintToolbar
          tool={tool}
          darknessMode={darknessMode}
          onChange={handleToolChange}
          brushSize={brushSize}
          onBrushSizeChange={handleBrushSizeChange}
          brushShape={brushShape}
          onBrushShapeChange={setBrushShape}
        />
        {activeSubdivision ? (
          <PiecePalette
            pieces={activePieces}
            activePieceId={activePieceId}
            onSelect={setActivePieceId}
          />
        ) : null}
        <div className={styles.secondaryActions}>
          <Button
            type="button"
            variant="default"
            size="mini"
            onClick={() => setShowShortcuts(true)}
            aria-label="Ver atajos de teclado"
            title="Atajos de teclado (?)"
          >
            <FontAwesomeIcon icon={faKeyboard} />
          </Button>
          <Popover
            side="right"
            ariaLabel="Configuración de clima"
            trigger={
              <Button type="button" size="mini" aria-label="Clima" title="Clima y ambiente">
                <FontAwesomeIcon icon={faCloud} />
              </Button>
            }
          >
            <WeatherPanel onChange={setWeatherState} initial={weatherState} />
          </Popover>
          <Popover
            side="right"
            ariaLabel="Acciones de limpieza"
            trigger={
              <Button
                type="button"
                size="mini"
                variant="danger"
                aria-label="Limpiar"
                title="Limpiar (menú)"
              >
                <FontAwesomeIcon icon={faTrash} />
              </Button>
            }
          >
            {() => (
              <div className={styles.dangerMenu}>
                <button
                  type="button"
                  className={styles.dangerItem}
                  onClick={handleClearAll}
                  disabled={paintedCells.length === 0}
                >
                  🗑 Todo el scenario
                </button>
                <button
                  type="button"
                  className={styles.dangerItem}
                  onClick={handleClearFloor}
                  disabled={paintedInFloor === 0}
                >
                  🗑 {activeFloor.name}
                </button>
                <button
                  type="button"
                  className={styles.dangerItem}
                  onClick={handleClearSubdivision}
                  disabled={
                    !activeSubdivision ||
                    paintedCells.filter(
                      (c) =>
                        c.floorId === activeFloorId &&
                        c.subdivisionId === activeSubdivisionId,
                    ).length === 0
                  }
                >
                  🗑 {activeSubdivision?.name ?? 'Subcapa'}
                </button>
              </div>
            )}
          </Popover>
        </div>
      </FloatingPanel>

      <FloatingPanel
        as="header"
        className={styles.floatingHeader}
        ariaLabel="Controles del editor"
        inert={!chromeVisible}
      >
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

        <SubdivisionTabs
          subdivisions={subdivisions}
          activeId={activeSubdivisionId}
          onChange={handleSubdivisionChange}
        />

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
      </FloatingPanel>

      <div className={styles.canvasStage}>
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
          darknessMode={darknessMode}
          brushSize={brushSize}
          brushShape={brushShape}
          showBrushPreview={showBrushPreview}
          onPaint={handlePaint}
          onDarknessErase={handleDarknessErase}
          onOpenTraitMenu={traitMenu.open}
          overlay={<WeatherOverlay weatherId={weatherState.weatherId} thunderAt={thunderAt} />}
        />
      </div>

      {traitMenu.render}

      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
