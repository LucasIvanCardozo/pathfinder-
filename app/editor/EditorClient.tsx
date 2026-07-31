'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  type BrushShape,
} from '@/canvas';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import { usePieceMap } from '@/hooks';
import { BenchmarkPanel, PerfHud, telemetry } from '@/lib/dev/perf';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/shared/constants/map';
import { DEFAULT_BRUSH_SHAPE, SUBDIVISIONS } from '@/lib/shared/constants';
import type { Floor, PaintedCell, Piece } from '@/lib/shared/types';
import { newId } from '@/lib/shared/utils/generateId';
import styles from './editor.module.css';
import { useFloorHeuristics } from './hooks/use-floor-heuristics';
import { useOpsBuffer } from './hooks/use-ops-buffer';
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

export function EditorClient({ initialScenario, allPieces }: Props) {
  const router = useRouter();
  const [scenarioId, setScenarioId] = useState<string | null>(initialScenario?.id ?? null);
  const [scenarioName, setScenarioName] = useState(initialScenario?.name ?? '');
  /**
   * `updatedAt` of the scenario at the moment we loaded it (or last
   * successful save). Server-returned after each save; used as
   * `baselineVersion` in the save request. `null` until the first save.
   */
  const [baselineVersion, setBaselineVersion] = useState<string | null>(null);
  const [floors, setFloors] = useState<Floor[]>(initialScenario?.floors ?? []);
  const [activeFloorId, setActiveFloorId] = useState(initialScenario?.activeFloorId ?? '');
  // Subdivisions are an immutable hardcoded set (see `SUBDIVISIONS`);
  // `initialSubdivisions` is accepted as a prop for backward compatibility
  // with the page-level prop shape but we never local-mutate it.
  const subdivisions = SUBDIVISIONS;
  const [paintedCells, setPaintedCells] = useState<PaintedCell[]>(
    initialScenario?.paintedCells ?? [],
  );
  const [activeSubdivisionId, setActiveSubdivisionId] = useState(SUBDIVISIONS[0]?.id ?? '');
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const [tool, setTool] = useState<PaintTool>('paint');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [brushShape, setBrushShape] = useState<BrushShape>(DEFAULT_BRUSH_SHAPE);
  /**
   * Toggle that hides the sidebar and lets the canvas area take the whole
   * viewport. Reset to `false` on each mount (per user choice: no
   * persistence). Browser F11 still works in parallel and hides the
   * browser chrome on top of this — they're independent.
   */
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
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

  // Ops buffer: every mutation that affects the scenario pushes an op here
  // instead of relying on `setPaintedCells` alone. The autosave hook drains
  // the buffer atomically when shipping the request. See `use-ops-buffer.ts`
  // for the full rationale (memory observation
  // "pathfinder-diff-based-autosave").
  const opsBuffer = useOpsBuffer();

  // Mirror `paintedCells` in a ref so `handlePaint` can read the current
  // cells without listing it in its useCallback deps. Including it would
  // recreate `handlePaint` on every paint (the state is a fresh array
  // every time), which propagates to FloorStack and invalidates the
  // `React.memo` on every `FloorCanvas` — defeating the inactive-floor
  // skip-render optimisation.
  const paintedCellsRef = useRef(paintedCells);
  paintedCellsRef.current = paintedCells;
  // Same trick for the ops buffer: `useOpsBuffer` returns a fresh object on
  // every render, so capturing it directly would recreate `handlePaint`
  // every render. Destructuring the individual pushers — which are
  // `useCallback([])`-stable — gives us stable references.
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
        // `router.replace` only changes the URL bar — it does NOT re-fetch
        // the RSC payload. After a save that wiped state (e.g. clearAllCells)
        // or rewrote cell rows in place, the server component's `findById`
        // may still return what the cache had pre-save on the next render.
        // `router.refresh()` forces a fresh fetch and discards the RSC
        // payload, so the next render reflects the post-save DB row count
        // exactly.
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
      // Two distinct composite keys, deliberately NOT the same closure:
      //   - `existingKey(c)` uses the floorId/subdivisionId from the
      //     existing cell. This is how we index the lookup maps so cells
      //     from DIFFERENT floors with the same (gridX, gridY) don't
      //     collide — that bug (caught in the op-based autosave refactor)
      //     caused `eraseIds` to receive the id of a cell from a different
      //     floor when painting/erasing on top of one with the same
      //     logical coordinates.
      //   - `strokeKey(gx, gy)` uses the stroke's floorId/subdivisionId.
      //     This is how we look up "is there an existing cell at this
      //     stroke position?" — the stroke is always one specific
      //     (floor, subdivision) so the lookup key matches.
      // The previous version used `floorId|subdivisionId` from the closure
      // for both — that meant cells from other floors had the wrong key
      // suffix in the map and were overwritten by the last cell to land on
      // that (gridX, gridY) coordinate.
      const existingKey = (c: {
        floorId: string;
        subdivisionId: string;
        gridX: number;
        gridY: number;
      }) => `${c.floorId}|${c.subdivisionId}|${c.gridX}|${c.gridY}`;
      const strokeKey = (gx: number, gy: number) =>
        `${floorId}|${subdivisionId}|${gx}|${gy}`;

      // Read the latest `paintedCells` from the ref, not the closure —
      // that's how we keep `paintedCells` out of this callback's deps.
      const currentPaintedCells = paintedCellsRef.current;

      if (tool === 'erase') {
        telemetry.recordEvent('erase');
        const next = applyEraseStroke({ stroke, paintedCells: currentPaintedCells });
        // Find which prev cells landed in the stroke but were removed —
        // these are the ids the server must delete.
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

      // Diff prev vs next. Cells that:
      //   - exist in next but not in prev → new (paint)
      //   - exist in both with the SAME pieceId → no-op (skip)
      //   - exist in both with a DIFFERENT pieceId → replace: erase the
      //     old id AND paint the new one (the old row stays in DB otherwise)
      const prevByKey = new Map(
        currentPaintedCells.map((c) => [existingKey(c), c]),
      );
      const nextByKey = new Map(next.map((c) => [existingKey(c), c]));

      const eraseIds: string[] = [];
      const paintCells: Array<{
        id: string;
        gridX: number;
        gridY: number;
        pieceId: string;
        entityState?: Record<string, string | number | boolean>;
      }> = [];

      for (const strokeCell of cells) {
        const key = strokeKey(strokeCell.gridX, strokeCell.gridY);
        const resulting = nextByKey.get(key);
        if (!resulting) continue;
        const prevCell = prevByKey.get(key);
        if (prevCell?.pieceId === pieceId) continue; // no-op
        if (prevCell) eraseIds.push(prevCell.id);
        paintCells.push({
          id: resulting.id,
          gridX: resulting.gridX,
          gridY: resulting.gridY,
          pieceId: resulting.pieceId,
          entityState: resulting.entityState,
        });
      }
      if (eraseIds.length > 0) pushErase(eraseIds);
      if (paintCells.length > 0) pushPaint(floorId, subdivisionId, paintCells);

      setPaintedCells(next);
    },
    // Deps are intentionally minimal: `paintedCells` and `opsBuffer` are
    // read via refs (paintedCellsRef / destructured pushers) so this
    // callback stays referentially stable across paints — that's what
    // lets FloorCanvas's `React.memo` actually skip re-rendering the
    // inactive floors below the active one.
    [tool, markDirty, pieceById, pushPaint, pushErase],
  );

  const handleSubdivisionChange = (id: string) => {
    // Pieces are global — the active piece persists across subdivision
    // changes so the brush keeps painting the same piece after switching.
    setActiveSubdivisionId(id);
  };

  useKeyboardShortcuts([
    { key: 'b', handler: () => setTool('paint') },
    { key: 'e', handler: () => setTool('erase') },
    { key: '[', handler: () => setBrushSize((s) => bumpBrushSizeDown(normalizeBrushSize(s))) },
    { key: ']', handler: () => setBrushSize((s) => bumpBrushSizeUp(normalizeBrushSize(s))) },
    // Shift+B toggles between circular and square brush shape. Modifying B
    // (the paint tool shortcut) is intentional — the same key covers both
    // paint-tool and brush-shape, with Shift as the modifier. The segmented
    // control in the PaintToolbar is the alternative.
    {
      key: 'b',
      shift: true,
      handler: () =>
        setBrushShape((current) => (current === 'circle' ? 'square' : 'circle')),
    },
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
      handler: () => {
        // Close the trait menu first (it's the more common reason the user
        // pressed Escape). Then, if it's already closed and the canvas is in
        // expanded mode, collapse it. This priority makes Escape feel like
        // "back out of whatever UI is on top".
        traitMenu.close();
        setIsCanvasExpanded(false);
      },
    },
    ...subdivisions.map((sub, i) => ({
      key: String(i + 1),
      handler: () => handleSubdivisionChange(sub.id),
    })),
    { key: 'ArrowUp', shift: true, handler: handleFloorUp },
    { key: 'ArrowDown', shift: true, handler: handleFloorDown },
  ]);

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
    opsBuffer.pushClearAll();
    markDirty();
  };

  const handleClearFloor = () => {
    if (
      !confirm(`¿Borrar todas las celdas pintadas de "${activeFloor.name}"? No se puede deshacer.`)
    )
      return;
    const fid = activeFloor.id;
    setPaintedCells((prev) => prev.filter((c) => c.floorId !== fid));
    opsBuffer.pushClearFloor(fid);
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
    opsBuffer.pushClearSubdivision(fid, sid);
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
          {/* Expand / collapse the canvas. Independent from the browser's
              native F11 fullscreen — that one hides the chrome but keeps the
              sidebar visible, this one hides the sidebar and lets the canvas
              area take the whole viewport. Both can be active at the same
              time. */}
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

        {/* Subdivision tabs are hidden in expanded mode so the canvas is
            the only thing on screen. The state still updates via the
            keyboard shortcut (keys 1..N) — we just don't render the
            strip. */}
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

      {/* Floating exit button — only rendered in expanded mode so the
          canvas is the only thing on screen and the user always has a way
          out. ESC also collapses, but the button is the visible affordance. */}
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
