'use client';

import {
  faCloud,
  faKeyboard,
  faShieldHalved,
  faTimes,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  applyEraseStroke,
  applyPaintStroke,
  type BrushShape,
  PaintToolbar,
  PiecePalette,
  type StrokeFootprint,
  SubdivisionTabs,
  useKeyboardShortcuts,
  WeatherOverlay,
  WeatherPanel,
} from '@/canvas';

import { SpellPalette } from '@/canvas/components/SpellPalette';

import {
  cycleRotationIndex,
  cycleSizeFor,
  MAX_CYCLE_SIZE,
  type RotationIndex,
  type SpellTemplateId,
  templateById,
} from '@/canvas/effects/spell-templates';
import type { ToolKind } from '@/canvas/tools';
import { clipFootprintByWalls, normalizeBrushSize } from '@/canvas/tools';
import { Button } from '@/components/Button';
import { FloatingPanel } from '@/components/FloatingPanel';
import { Modal } from '@/components/Modal';
import { Popover } from '@/components/Popover';
import { ShortcutsModal } from '@/components/ShortcutsModal';
import { Spinner } from '@/components/Spinner';
import { telemetry } from '@/dev/perf/telemetry';
import { usePieceMap } from '@/hooks';
import { DARKNESS_PIECE_ID, DEFAULT_BRUSH_SHAPE, SUBDIVISIONS } from '@/lib/shared/constants';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/shared/constants/map';
import type { CombatView, Floor, PaintedCell, Piece, ScenarioEffect } from '@/lib/shared/types';
import { newId } from '@/lib/shared/utils/generateId';
import { CombatModal } from './components/CombatModal/CombatModal';
import { RoundViewer } from './components/RoundViewer';
import styles from './editor.module.css';
import { useClearHandlers } from './hooks/use-clear-handlers';
import { useCombatOps } from './hooks/use-combat-ops';
import { useCombatSession } from './hooks/use-combat-session';
import { useFloorHeuristics } from './hooks/use-floor-heuristics';
import { useHistory } from './hooks/use-history';
import { useOpsBuffer } from './hooks/use-ops-buffer';
import { usePaintStrokeDiff } from './hooks/use-paint-stroke-diff';
import { useScenarioAutosave } from './hooks/use-scenario-autosave';
import { useSpellOps } from './hooks/use-spell-ops';
import { useTraitMenu } from './hooks/use-trait-menu';
import { useWeatherSession } from './hooks/use-weather-session';
import { useZoomControl } from './hooks/use-zoom-control';
import { buildEditorShortcuts } from './shortcuts';

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
  /** Persisted spell markers for the scenario. PR 2 of the spellcasting
   *  refactor re-introduces the read-side here (PR 1 dropped it). */
  effects: ScenarioEffect[];
  combat: CombatView | null;
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
  const [tool, setTool] = useState<ToolKind>('paint');
  const [darknessMode, setDarknessMode] = useState<'apply' | 'erase'>('apply');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [brushShape, setBrushShape] = useState<BrushShape>(DEFAULT_BRUSH_SHAPE);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const modalOpenRef = useRef(false);

  // PR 2 of the spellcasting refactor: spell markers state. `effects`
  // mirrors the persisted rows (write-side goes through the ops buffer
  // + autosave); `markerTooltip` holds the marker the canvas clicked so
  // the EffectTooltip can render a "Quitar" action. `selectedSpellTemplateId`
  // + `spellRotationIndex` drive the brush preview when `tool === 'effects'`.
  const [effects, setEffects] = useState<ScenarioEffect[]>(initialScenario?.effects ?? []);
  // Re-sync local `effects` whenever the server-rendered scenario reference
  // changes. `useState` only reads its argument on mount; without this
  // effect server-side mutations (e.g. `nextTurn` expiring a spell via
  // `effectRepository.expireRoundInTx`) keep their old copy in client state until a hard
  // reload. We compare against the array reference (not the serialized
  // contents) so the rare case where the server ends with the same shape
  // after a batched mutation still triggers reconciliation.
  useEffect(() => {
    setEffects(initialScenario?.effects ?? []);
  }, [initialScenario?.effects]);
  const [selectedSpellTemplateId, setSelectedSpellTemplateId] = useState<SpellTemplateId | null>(
    null,
  );
  const [spellRotationIndex, setSpellRotationIndex] = useState<RotationIndex>(0);
  // Cycle length depends on the active template: cones have 2 figures (8
  // states), circles have 1 figure (4 states, visually invariant due to
  // symmetry). Default to the catalog max when no template is selected.
  const rotateSpell = useCallback(() => {
    const cycleSize = selectedSpellTemplateId
      ? cycleSizeFor(templateById(selectedSpellTemplateId))
      : MAX_CYCLE_SIZE;
    setSpellRotationIndex(cycleRotationIndex(spellRotationIndex, cycleSize));
  }, [selectedSpellTemplateId, spellRotationIndex]);
  // Reset the rotation cycle when the GM picks a different template. Each
  // template carries its own `defaultRotationIndex` (always 0 today, but the
  // hook makes the contract explicit so a future template can open at a
  // non-zero state). Without this, switching from cone-30 rotated to SE
  // back to cone-15 would carry the diagonal state over and the GM would
  // have to cycle back to cardinal manually.
  useEffect(() => {
    if (!selectedSpellTemplateId) {
      setSpellRotationIndex(0);
      return;
    }
    const template = templateById(selectedSpellTemplateId);
    setSpellRotationIndex(template.defaultRotationIndex);
  }, [selectedSpellTemplateId]);
  // PR 4: PF1e-style spell lifetime in world rounds. Defaults to 1
  // (matches the previous "dies on the caster's next turn" behaviour).
  // The SpellPalette `<select>` is fully controlled by this state —
  // every change commits immediately, no buffer / debounce needed.
  const [spellDurationRounds, setSpellDurationRounds] = useState<number>(1);

  /**
   * Snapshot of the user-visible state needed to roll back a mutation. The
   * editor has more `useState` slots (brush size, tool, chrome visibility…),
   * but they are *settings* the user re-applies on top of the scenario — the
   * undo stack only tracks the scenario's persistent state.
   *
   * `buildSnapshot` reads from refs (not from React state) so it stays
   * referentially stable across renders — `handlePaint`'s deps don't need
   * to include it, and the `FloorCanvas` memo comparator keeps its current
   * shape (recreating `handlePaint` on every state change would force a
   * full canvas re-render on every paint stroke).
   */
  type EditorSnapshot = {
    paintedCells: readonly PaintedCell[];
    floors: readonly Floor[];
    activeFloorId: string;
    scenarioName: string;
  };
  const history = useHistory<EditorSnapshot>({ max: 100 });

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
  // Freeze the piece catalog reference on mount. The catalog is build-time
  // static (`pnpm gen-cat`, `'use cache'` with `cacheLife('hours')`), so the
  // first value is the right one for the lifetime of this editor instance.
  // Without this, `router.refresh()` after save re-runs the Server Component
  // and `listAllPieces()` returns a new array (same content, new reference),
  // which propagates to `FloorStack` -> `FloorCanvas` and trips the memo
  // comparator on `pieces` for every inactive floor.
  const [stableAllPieces] = useState(allPieces);
  const activePieces = stableAllPieces;
  const pieceById = usePieceMap(stableAllPieces);
  const { computeStrokeDiff, computeRemovedIds } = usePaintStrokeDiff();

  const markDirty = useCallback(() => setIsDirty(true), []);
  const opsBuffer = useOpsBuffer();

  const combatSession = useCombatSession(initialScenario?.combat ?? null);

  // Mirror `paintedCells` in a ref so `handlePaint` can read the current
  // cells without listing them in its useCallback deps (see `use-ops-buffer`
  // for the rationale on stability). The same refs back `buildSnapshot` so it
  // can read fresh state without forcing `handlePaint` to list it.
  const paintedCellsRef = useRef(paintedCells);
  paintedCellsRef.current = paintedCells;
  const floorsRef = useRef(floors);
  floorsRef.current = floors;
  const activeFloorIdRef = useRef(activeFloorId);
  activeFloorIdRef.current = activeFloorId;
  const scenarioNameRef = useRef(scenarioName);
  scenarioNameRef.current = scenarioName;
  const buildSnapshot = useCallback(
    (): EditorSnapshot => ({
      paintedCells: paintedCellsRef.current,
      floors: floorsRef.current,
      activeFloorId: activeFloorIdRef.current,
      scenarioName: scenarioNameRef.current,
    }),
    [],
  );
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

  const [combatModalOpen, setCombatModalOpen] = useState(false);
  // PR 4: header pill Finalizar combate confirm dialog. Lives next to
  // `combatModalOpen` because both gate on `combatSession.isActive`.
  const [confirmEndCombat, setConfirmEndCombat] = useState(false);
  const openCombatModal = useCallback(() => {
    setCombatModalOpen(true);
    modalOpenRef.current = true;
  }, []);
  const closeCombatModal = useCallback(() => {
    setCombatModalOpen(false);
    modalOpenRef.current = false;
  }, []);
  const toggleCombatModal = useCallback(() => {
    if (combatModalOpen) {
      closeCombatModal();
      return;
    }
    openCombatModal();
  }, [closeCombatModal, combatModalOpen, openCombatModal]);

  const combatOps = useCombatOps({
    scenarioId,
    combatSession,
    opsBuffer,
    setEffects,
    markDirty,
    closeCombatModal,
  });

  // PR 2 of the spellcasting refactor: spell wire. Pushes go through
  // the existing ops buffer + autosave; the local `effects` state mirrors
  // the persisted row so the marker renders on the next paint frame
  // (optimistic UI). The cast snapshot (casterCombatantId + castOnTurnIndex
  // + castOnRoundNumber) drives the server-side expiry rule.
  const spellOps = useSpellOps({
    scenarioId,
    opsBuffer,
    setEffects,
    markDirty,
  });

  const handleSubdivisionChange = (id: string) => {
    setActiveSubdivisionId(id);
    // Cada subcapa tiene su propio `cellSizeRatio`, así que el footprint del
    // pincel se "percibe" distinto en cada una. Volvemos a 1x1 al cambiar de
    // tab para que un tamaño elegido en una subcapa no contamine la siguiente.
    setBrushSize(1);
  };

  const handlePaint = useCallback(
    (
      floorId: string,
      subdivisionId: string,
      cells: { gridX: number; gridY: number }[],
      pieceId: string | null,
    ) => {
      if (cells.length === 0) return;

      // Dedupe intra-batch: the brush emits cells that overlap across
      // onMouseMove ticks, so the same (gridX, gridY) can appear multiple
      // times in `cells`. Filtering here keeps every downstream reducer
      // and the diff machinery from processing duplicates.
      const seen = new Set<string>();
      const uniqueCells = cells.filter((c) => {
        const key = `${c.gridX}|${c.gridY}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (uniqueCells.length === 0) return;

      const stroke = { floorId, subdivisionId, cells: uniqueCells };
      const currentPaintedCells = paintedCellsRef.current;

      // Path 1: darkness apply. Bypasses the normal paint/erase reducers.
      // Filters out cells that already carry darkness so painting the same
      // patch twice doesn't duplicate the underlying rows. Without this,
      // every drag over an already-darkened area appends new cells with
      // fresh ids.
      if (tool === 'darkness' && subdivisionId === 'obscured' && pieceId === DARKNESS_PIECE_ID) {
        // `darknessKey` must include the per-cell floorId. Painting darkness
        // in floor A then floor B at the same logical (gx, gy) used to
        // collide because the closure captured only the stroke's floorId,
        // so every existing darkness cell got keyed against the active
        // floor — making the dedupe think B's stroke was entirely over
        // already-painted darkness.
        const darknessKey = (fId: string, gx: number, gy: number) => `${fId}|obscured|${gx}|${gy}`;
        const existing = new Set(
          currentPaintedCells
            .filter((c) => c.pieceId === DARKNESS_PIECE_ID)
            .map((c) => darknessKey(c.floorId, c.gridX, c.gridY)),
        );
        const newCells = uniqueCells
          .filter((c) => !existing.has(darknessKey(floorId, c.gridX, c.gridY)))
          .map((c) => ({
            id: newId('cell'),
            floorId,
            subdivisionId: 'obscured',
            gridX: c.gridX,
            gridY: c.gridY,
            pieceId: DARKNESS_PIECE_ID,
          }));
        if (newCells.length === 0) return; // stroke was entirely over darkness
        telemetry.recordEvent('paint');
        history.record(buildSnapshot());
        pushPaint(floorId, 'obscured', newCells);
        setPaintedCells((prev) => [...prev, ...newCells]);
        markDirty();
        return;
      }

      // Path 2: erase. Short-circuits if the stroke is over an empty
      // patch — the reducer would still run and trigger a re-render.
      if (tool === 'erase') {
        const removedIds = computeRemovedIds(currentPaintedCells, stroke);
        if (removedIds.length === 0) return;
        const next = applyEraseStroke({
          stroke,
          paintedCells: currentPaintedCells,
        });
        telemetry.recordEvent('erase');
        history.record(buildSnapshot());
        pushErase(removedIds);
        setPaintedCells(next);
        markDirty();
        return;
      }

      // Path 3: normal paint. Short-circuits when the stroke lands entirely
      // on cells that already carry the same piece — `computeStrokeDiff`
      // already excludes those, so the diff result is the ground truth.
      if (!pieceId) return;
      const next = applyPaintStroke({
        stroke,
        pieceId,
        pieceById,
        paintedCells: currentPaintedCells,
        generateId: () => newId('cell'),
      });
      const { eraseIds, paintCells } = computeStrokeDiff(currentPaintedCells, next, stroke);
      if (eraseIds.length === 0 && paintCells.length === 0) return;
      telemetry.recordEvent('paint');
      history.record(buildSnapshot());
      if (eraseIds.length > 0) pushErase(eraseIds);
      if (paintCells.length > 0) pushPaint(floorId, subdivisionId, paintCells);
      setPaintedCells(next);
      markDirty();
    },
    [
      tool,
      markDirty,
      pieceById,
      pushPaint,
      pushErase,
      computeStrokeDiff,
      computeRemovedIds,
      history,
      buildSnapshot,
    ],
  );

  const handleToolChange = (newTool: ToolKind) => {
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
    // The hechizo tool requires an active combat (it needs a caster to
    // attach the spell to). Shortcut here: toast + return. The current
    // tool stays put so the aside keeps showing whatever palette was
    // already mounted (paint → PiecePalette, erase/darkness → placeholder).
    if (newTool === 'effects' && !combatSession.isActive) {
      toast.error('Iniciá un combate para usar hechizos', {
        id: 'spell-needs-combat',
        duration: 3500,
      });
      return;
    }
    // Any non-darkness tool leaves the current darkness mode unchanged.
    setTool(newTool);
  };
  const handleBrushSizeChange = (size: number) => setBrushSize(normalizeBrushSize(size));

  const handleDarknessErase = useCallback(
    (floorId: string, footprints: StrokeFootprint[]) => {
      if (footprints.length === 0) return;
      // Record the pre-erase state so undo can restore the darkness cells.
      // Done before the `removedIds.length === 0` guard because the record
      // is harmless even if the erase ends up a no-op (one redundant step
      // in the history).
      history.record(buildSnapshot());
      const current = paintedCellsRef.current;

      // Precompute the structure walls for this floor once. Structures
      // (`subdivisionId === 'estructuras'`) act as propagation walls for the
      // darkness erase: the BFS per footprint erases the wall's own darkness
      // (so it stays visible) but stops there, so cells behind the wall keep
      // their darkness.
      const wallKeys = new Set<string>();
      for (const c of current) {
        if (c.floorId === floorId && c.subdivisionId === 'estructuras') {
          wallKeys.add(`${c.gridX}|${c.gridY}`);
        }
      }
      const isWall = (x: number, y: number) => wallKeys.has(`${x}|${y}`);

      // Run wall-aware BFS per stamp so a wall in one stamp does not bleed
      // into the next. Accumulates the union of eraseable cell coords.
      const eraseable = new Set<string>();
      for (const { centre, cells } of footprints) {
        if (cells.length === 0) continue;
        const filtered = clipFootprintByWalls(centre, cells, isWall);
        for (const f of filtered) eraseable.add(`${f.gridX}|${f.gridY}`);
      }

      if (eraseable.size === 0) return;

      const byKey = new Map(
        current.map((c) => [`${c.floorId}|${c.subdivisionId}|${c.gridX}|${c.gridY}`, c]),
      );
      const removedIds: string[] = [];
      for (const key of eraseable) {
        const [gx, gy] = key.split('|').map(Number);
        const found = byKey.get(`${floorId}|obscured|${gx}|${gy}`);
        if (found) removedIds.push(found.id);
      }
      if (removedIds.length === 0) return;
      markDirty();
      telemetry.recordEvent('erase');
      pushErase(removedIds);
      setPaintedCells((prev) => prev.filter((c) => !removedIds.includes(c.id)));
    },
    [markDirty, pushErase, history, buildSnapshot],
  );

  const { handleClearAll, handleClearFloor, handleClearSubdivision } = useClearHandlers({
    opsBuffer,
    activeFloor,
    activeSubdivisionId,
    activeSubdivisionName: activeSubdivision?.name,
    markDirty,
    setPaintedCells,
    paintedCellsRef,
    recordHistory: () => history.record(buildSnapshot()),
  });

  const handleUndo = useCallback(() => {
    const previous = history.undo(buildSnapshot());
    if (!previous) return;
    setPaintedCells([...previous.paintedCells]);
    setFloors([...previous.floors]);
    setActiveFloorId(previous.activeFloorId);
    setScenarioName(previous.scenarioName);
    // The pending ops in the buffer were generated against the post-mutation
    // state we just rolled back. Mark the buffer dirty so the next drain
    // returns [] and the server stays in sync with the undone state.
    opsBuffer.markDirtyForRebase();
  }, [history, buildSnapshot, opsBuffer.markDirtyForRebase]);

  const handleRedo = useCallback(() => {
    const next = history.redo(buildSnapshot());
    if (!next) return;
    setPaintedCells([...next.paintedCells]);
    setFloors([...next.floors]);
    setActiveFloorId(next.activeFloorId);
    setScenarioName(next.scenarioName);
    opsBuffer.markDirtyForRebase();
  }, [history, buildSnapshot, opsBuffer.markDirtyForRebase]);

  useKeyboardShortcuts(
    buildEditorShortcuts({
      setTool: handleToolChange,
      setBrushSize,
      setBrushShape,
      setShowShortcuts,
      toggleCombat: toggleCombatModal,
      nextTurn: combatOps.nextTurn,
      previousTurn: combatOps.previousTurn,
      advanceRound: combatOps.advanceRound,
      closeCombatModal,
      rotateSpell,
      modalOpenRef,
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
      handleUndo,
      handleRedo,
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
        <div className={styles.secondaryActions}>
          <Button
            type="button"
            variant={combatSession.isActive ? 'primary' : 'default'}
            size="mini"
            onClick={() => openCombatModal()}
            aria-label="Combate"
            title="Combate (C)"
          >
            <FontAwesomeIcon icon={faShieldHalved} />
          </Button>
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
                  <FontAwesomeIcon icon={faTrash} aria-hidden="true" /> Todo el scenario
                </button>
                <button
                  type="button"
                  className={styles.dangerItem}
                  onClick={handleClearFloor}
                  disabled={paintedInFloor === 0}
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden="true" /> {activeFloor.name}
                </button>
                <button
                  type="button"
                  className={styles.dangerItem}
                  onClick={handleClearSubdivision}
                  disabled={
                    !activeSubdivision ||
                    paintedCells.filter(
                      (c) => c.floorId === activeFloorId && c.subdivisionId === activeSubdivisionId,
                    ).length === 0
                  }
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden="true" />{' '}
                  {activeSubdivision?.name ?? 'Subcapa'}
                </button>
              </div>
            )}
          </Popover>
        </div>
        <PaintToolbar
          tool={tool}
          darknessMode={darknessMode}
          onChange={handleToolChange}
          brushSize={brushSize}
          onBrushSizeChange={handleBrushSizeChange}
          brushShape={brushShape}
          onBrushShapeChange={setBrushShape}
          combatActive={combatSession.isActive}
        />
        {tool === 'paint' && activeSubdivision ? (
          <PiecePalette
            pieces={activePieces}
            activePieceId={activePieceId}
            onSelect={setActivePieceId}
          />
        ) : null}
        {tool === 'effects' && combatSession.isActive && (
          <SpellPalette
            selectedId={selectedSpellTemplateId}
            onSelect={(id) => setSelectedSpellTemplateId((prev) => (prev === id ? null : id))}
            durationRounds={spellDurationRounds}
            onDurationChange={setSpellDurationRounds}
          />
        )}
        {tool === 'erase' || tool === 'darkness' ? (
          <p className={styles.helpText}>Esta herramienta no usa piezas ni hechizos.</p>
        ) : null}
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
          ) : scenarioId ? (
            'Guardar'
          ) : (
            'Crear'
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
          effects={effects}
          pieces={stableAllPieces}
          activeSubdivisionId={activeSubdivisionId}
          activePieceId={activePieceId}
          tool={tool}
          darknessMode={darknessMode}
          brushSize={brushSize}
          brushShape={brushShape}
          showBrushPreview={chromeVisible}
          onPaint={handlePaint}
          onDarknessErase={handleDarknessErase}
          onOpenTraitMenu={traitMenu.open}
          onRotateSpell={rotateSpell}
          onPlaceSpell={(cell) => {
            if (!selectedSpellTemplateId) {
              // Tool is `effects` but no template was picked from the
              // SpellPalette. Tell the GM instead of failing silently.
              toast.error('Elegí un hechizo del panel para colocar.', {
                id: 'spell-no-template',
              });
              return;
            }
            const caster = combatSession.currentCombatant;
            if (!caster) {
              // The hechizo needs a caster for the expiry rule. The
              // combat exists but has no combatants (or the cursor
              // points out of range). Tell the GM instead of failing
              // silently.
              toast.error('Agregá un combatiente al combate antes de lanzar un hechizo.', {
                id: 'spell-no-caster',
              });
              return;
            }
            // Defensive: the caster picked from the sorted list must
            // exist in the live combatant roster, otherwise the wire
            // would carry a `casterCombatantId` that the server cannot
            // satisfy and the save would 500. This branch is only
            // reachable if the local state has drifted (e.g. an
            // `addCombatant` op was queued but not yet flushed to the
            // combatant list) — surface it instead of failing silently.
            if (!combatSession.combat?.combatants.some((c) => c.id === caster.id)) {
              toast.error('Estado de combate inconsistente. Recargá la página.', {
                id: 'spell-stale-combat',
              });
              return;
            }
            spellOps.pushAddEffect({
              id: newId('effect'),
              floorId: activeFloorId,
              templateId: selectedSpellTemplateId,
              originCellX: cell.gridX,
              originCellY: cell.gridY,
              rotationIndex: spellRotationIndex,
              durationRounds: spellDurationRounds,
              casterCombatantId: caster.id,
              castOnTurnIndex: combatSession.combat?.currentTurnIndex ?? 0,
              castOnRoundNumber: combatSession.combat?.roundNumber ?? 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            setSelectedSpellTemplateId(null);
          }}
          selectedSpellTemplateId={selectedSpellTemplateId}
          spellRotationIndex={spellRotationIndex}
          overlay={<WeatherOverlay weatherId={weatherState.weatherId} thunderAt={thunderAt} />}
        />
      </div>

      {traitMenu.render}

      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <RoundViewer combat={combatSession.combat} onEndCombat={() => setConfirmEndCombat(true)} />
      <CombatModal
        isOpen={combatModalOpen}
        onClose={closeCombatModal}
        combat={combatSession.combat}
        onStartCombat={combatOps.startCombat}
        onEndCombat={combatOps.endCombat}
        onAddCombatant={combatOps.addCombatant}
        onRemoveCombatant={combatOps.removeCombatant}
      />
      <Modal
        isOpen={confirmEndCombat}
        title="¿Finalizar el combate?"
        onClose={() => setConfirmEndCombat(false)}
      >
        <p className={styles.confirmMessage}>
          Se borrarán todos los combatientes del combate actual y la ronda vuelve a 1 cuando inicies
          el próximo. Esta acción no se puede deshacer.
        </p>
        <div className={styles.confirmActions}>
          <Button type="button" onClick={() => setConfirmEndCombat(false)} title="Cancelar">
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setConfirmEndCombat(false);
              combatOps.endCombat();
            }}
            title="Confirmar finalización"
          >
            <FontAwesomeIcon icon={faTimes} /> Finalizar combate
          </Button>
        </div>
      </Modal>
    </div>
  );
}
