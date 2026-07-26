'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import {
  type PaintTool,
  PaintToolbar,
  PiecePalette,
  SubdivisionTabs,
  WeatherOverlay,
  WeatherPanel,
  type WeatherState,
  WEATHER_DEFAULT,
  getInteractiveTrait,
  getTextureTraits,
  getWeather,
  useKeyboardShortcuts,
  useWeatherAudio,
} from '@/canvas'
import type { Floor, PaintedCell, Piece, SubdivisionConfig } from '@/lib/shared/types'
import { saveScenario } from '@/lib/server/actions/scenario.action'
import { reorderSubdivisions } from '@/lib/server/actions/subdivision.action'
import { generateId } from '@/lib/shared/utils/generateId'
import { useReload } from '@/hooks'
import { Button } from '@/components/Button'
import { Empty } from '@/components/Empty'
import { SubdivisionManager } from '@/components/SubdivisionManager'
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '@/lib/shared/constants/map'
import styles from './Editor.module.css'

const AUTOSAVE_INTERVAL_MS = 60 * 1000

const PaintCanvas = dynamic(() => import('@/canvas/konva').then((m) => m.PaintCanvas), {
  ssr: false,
  loading: () => <div className={styles.canvasLoading}>Cargando canvas…</div>,
})

type InitialScenario = {
  id: string
  name: string
  baseCellSize: number
  width: number
  height: number
  floors: Floor[]
  activeFloorId: string
  paintedCells: PaintedCell[]
}

type Props = {
  initialScenario: InitialScenario | null
  initialSubdivisions: SubdivisionConfig[]
  allPieces: Piece[]
}

export function EditorClient({ initialScenario, initialSubdivisions, allPieces }: Props) {
  const router = useRouter()
  const { startReload } = useReload()
  const [scenarioId, setScenarioId] = useState<string | null>(initialScenario?.id ?? null)
  const [scenarioName, setScenarioName] = useState(initialScenario?.name ?? '')
  const [floors, setFloors] = useState<Floor[]>(initialScenario?.floors ?? [])
  const [activeFloorId, setActiveFloorId] = useState(initialScenario?.activeFloorId ?? '')
  const [subdivisions, setSubdivisions] = useState<SubdivisionConfig[]>(initialSubdivisions)
  const [paintedCells, setPaintedCells] = useState<PaintedCell[]>(initialScenario?.paintedCells ?? [])
  const [activeSubdivisionId, setActiveSubdivisionId] = useState(initialSubdivisions[0]?.id ?? '')
  const [activePieceId, setActivePieceId] = useState<string | null>(null)
  const [tool, setTool] = useState<PaintTool>('paint')
  const [isManaging, setIsManaging] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [, startSaveTransition] = useTransition()
  const [isSaving, setIsSaving] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const [traitMenu, setTraitMenu] = useState<{
    cellId: string
    traitKind: string
    position: { x: number; y: number }
  } | null>(null)

  // Weather state is ephemeral (not persisted). Panel writes to here; audio
  // and overlay read from here.
  const [weatherState, setWeatherState] = useState<WeatherState>(WEATHER_DEFAULT)
  // When the storm's thunder audio fires, the audio hook calls back here
  // and we forward the timestamp to StormEffect for a synced flash.
  const [thunderAt, setThunderAt] = useState<number | null>(null)
  const weatherDef = getWeather(weatherState.weatherId)
  useWeatherAudio(weatherDef.sound, weatherState.volume / 100, (src) => {
    if (src.endsWith('thunder.mp3')) setThunderAt(Date.now())
  })

  const fallbackFloor: Floor = { id: '', name: '' }
  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0] ?? fallbackFloor
  const mapDims = {
    baseCellSize: initialScenario?.baseCellSize ?? 64,
    width: initialScenario?.width ?? 100,
    height: initialScenario?.height ?? 300,
  }
  const [zoom, setZoom] = useState(1)
  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
  const activeSubdivision = subdivisions.find((s) => s.id === activeSubdivisionId)
  // Pieces are global — every piece is paintable in any subdivision cell.
  const activePieces = allPieces

  // Derive the "used" set from the actual painted cells (not from the
  // subdivision declarations). The previous implementation used
  // `subdivisions[i].pieceIds`, which over-reported (declared but unpainted)
  // and missed anything painted that wasn't pre-declared.
  const usedPieceIds = useMemo(() => new Set(paintedCells.map((c) => c.pieceId)), [paintedCells])
  const allUsedPieces = useMemo(() => allPieces.filter((p) => usedPieceIds.has(p.id)), [allPieces, usedPieceIds])

  const pieceById = useMemo(() => {
    const m = new Map<string, Piece>()
    for (const p of allPieces) m.set(p.id, p)
    return m
  }, [allPieces])

  const markDirty = useCallback(() => setIsDirty(true), [])

  const handlePaint = useCallback(
    (
      floorId: string,
      subdivisionId: string,
      gridX: number,
      gridY: number,
      pieceId: string | null,
      screenPos: { x: number; y: number } | null,
      isDragging: boolean
    ) => {
      markDirty()

      if (tool === 'erase') {
        setPaintedCells((prev) => prev.filter((c) => !(c.floorId === floorId && c.subdivisionId === subdivisionId && c.gridX === gridX && c.gridY === gridY)))
        return
      }

      if (!pieceId) return

      const newPiece = pieceById.get(pieceId)
      const traits = newPiece ? getTextureTraits(newPiece) : []
      const statefulTrait = traits.find((t) => t.defaultState)
      const entityState = statefulTrait?.defaultState ? { [statefulTrait.kind]: statefulTrait.defaultState() } : undefined

      setPaintedCells((prev) => {
        const filtered = prev.filter((c) => !(c.floorId === floorId && c.subdivisionId === subdivisionId && c.gridX === gridX && c.gridY === gridY))
        return [
          ...filtered,
          {
            id: generateId('cell'),
            floorId,
            subdivisionId,
            gridX,
            gridY,
            pieceId,
            entityState: entityState as Record<string, string | number | boolean> | undefined,
          },
        ]
      })
    },
    [tool, markDirty, paintedCells, pieceById, mapDims.baseCellSize]
  )

  const handleSubdivisionChange = (id: string) => {
    setActiveSubdivisionId(id)
    setActivePieceId(null)
  }

  const handleReorder = useCallback(
    async (fromId: string, toId: string, side: 'left' | 'right') => {
      if (fromId === toId) return
      const fromIdx = subdivisions.findIndex((s) => s.id === fromId)
      const toIdx = subdivisions.findIndex((s) => s.id === toId)
      if (fromIdx === -1 || toIdx === -1) return

      const moved = subdivisions[fromIdx]!
      const without = subdivisions.filter((_, i) => i !== fromIdx)
      const newToIdx = without.findIndex((s) => s.id === toId)
      const insertAt = side === 'left' ? newToIdx : newToIdx + 1
      without.splice(insertAt, 0, moved)

      const renumbered = without.map((s, i) => ({ ...s, order: i }))
      setSubdivisions(renumbered)
      markDirty()
      const result = await reorderSubdivisions(renumbered.map((s) => ({ id: s.id, order: s.order })))
      // Re-validate from server: action returns bare void on success;
      // silent failure would leave local state desynced. startReload
      // triggers a silent RSC refresh via router.refresh() inside
      // startTransition (no loading flash).
      if (result.success) startReload()
    },
    [subdivisions, markDirty, startReload]
  )

  const activeFloorIndex = floors.findIndex((f) => f.id === activeFloorId)
  const handleFloorUp = () => {
    if (activeFloorIndex < floors.length - 1) {
      setActiveFloorId(floors[activeFloorIndex + 1]!.id)
    }
  }
  const handleFloorDown = () => {
    if (activeFloorIndex > 0) {
      setActiveFloorId(floors[activeFloorIndex - 1]!.id)
    }
  }

  useKeyboardShortcuts([
    { key: 'b', handler: () => setTool('paint') },
    { key: 'e', handler: () => setTool('erase') },
    {
      key: 's',
      ctrl: true,
      handler: () => {
        if (isSaving) return
        startSaveTransition(() => handleSave(false))
      },
    },
    {
      key: 'Escape',
      handler: () => setTraitMenu(null),
    },
    ...subdivisions.map((sub, i) => ({
      key: String(i + 1),
      handler: () => handleSubdivisionChange(sub.id),
    })),
    { key: 'ArrowUp', shift: true, handler: handleFloorUp },
    { key: 'ArrowDown', shift: true, handler: handleFloorDown },
  ])

  const handleCloseManager = async () => {
    setIsManaging(false)
    // Dynamic import keeps the action bundle out of the initial editor
    // chunk — the manager only needs it when the user opens the modal.
    // The action returns the canonical envelope; unwrap here so the rest
    // of the file deals with DTOs only.
    const result = await import('@/lib/server/actions/subdivision.action').then((m) => m.listSubdivisions())
    const fresh = result.success ? result.data : []
    setSubdivisions(fresh)
    if (!fresh.find((s) => s.id === activeSubdivisionId)) {
      setActiveSubdivisionId(fresh[0]?.id ?? '')
    }
  }

  const handleOpenTraitMenu = useCallback((cellId: string, traitKind: string, position: { x: number; y: number }) => {
    setTraitMenu({ cellId, traitKind, position })
  }, [])

  const handleChangeTraitState = useCallback(
    (newState: unknown) => {
      if (!traitMenu) return
      setPaintedCells((prev) =>
        prev.map((c) => (c.id === traitMenu.cellId ? { ...c, entityState: { ...c.entityState, [traitMenu.traitKind]: newState as string } } : c))
      )
      markDirty()
      setTraitMenu(null)
    },
    [traitMenu, markDirty]
  )

  const handleCloseTraitMenu = useCallback(() => setTraitMenu(null), [])

  const handleToolChange = (newTool: PaintTool) => {
    setTool(newTool)
  }

  const plantaBajaIndex = floors.findIndex((f) => f.name.toLowerCase() === 'planta baja')
  const floorNameForIndex = (index: number): string => {
    if (index === plantaBajaIndex) return 'Planta Baja'
    if (plantaBajaIndex === -1) return `Piso ${index}`
    if (index < plantaBajaIndex) return `Subsuelo ${plantaBajaIndex - index}`
    return `Piso ${index - plantaBajaIndex}`
  }

  const makeFloor = (name: string): Floor => ({
    id: generateId('floor'),
    name,
  })

  const handleAddFloorAbove = () => {
    const newIndex = floors.length
    const newFloor = makeFloor(floorNameForIndex(newIndex))
    setFloors((prev) => [...prev, newFloor])
    setActiveFloorId(newFloor.id)
    markDirty()
  }

  const handleAddFloorBelow = () => {
    const newN = plantaBajaIndex + 1
    const newFloor = makeFloor(`Subsuelo ${newN}`)
    setFloors((prev) => [newFloor, ...prev])
    setActiveFloorId(newFloor.id)
    markDirty()
  }

  const isAtTop = activeFloorIndex === floors.length - 1
  const isAtBottom = activeFloorIndex === 0
  const isPlantaBaja = activeFloor.name.toLowerCase() === 'planta baja'
  const canDeleteFloor = floors.length > 1 && !isPlantaBaja && (isAtTop || isAtBottom)

  const handleDeleteFloor = () => {
    if (!canDeleteFloor) return
    if (!confirm(`¿Borrar "${activeFloor.name}"? Las celdas pintadas de este piso se perderán.`)) return
    const idx = activeFloorIndex
    const remaining = floors.filter((_, i) => i !== idx)
    setFloors(remaining)
    const newIdx = Math.min(idx, remaining.length - 1)
    setActiveFloorId(remaining[newIdx]!.id)
    markDirty()
  }

  const handleClearAll = () => {
    if (!confirm('¿Borrar TODO el scenario (pintadas de todos los pisos)? No se puede deshacer.')) return
    setPaintedCells([])
    markDirty()
  }

  const handleClearFloor = () => {
    if (!confirm(`¿Borrar todas las celdas pintadas de "${activeFloor.name}"? No se puede deshacer.`)) return
    const fid = activeFloor.id
    setPaintedCells((prev) => prev.filter((c) => c.floorId !== fid))
    markDirty()
  }

  const handleClearSubdivision = () => {
    if (!activeSubdivision) return
    if (!confirm(`¿Borrar todas las celdas pintadas de "${activeSubdivision.name}" en "${activeFloor.name}"? No se puede deshacer.`)) return
    const fid = activeFloor.id
    const sid = activeSubdivisionId
    setPaintedCells((prev) => prev.filter((c) => !(c.floorId === fid && c.subdivisionId === sid)))
    markDirty()
  }

  const handleSave = useCallback(
    (isAutosave = false) => {
      const doSave = async () => {
        if (isAutosave && !isDirty) return
        setAutosaveStatus('saving')
        setIsSaving(true)
        try {
          const result = await saveScenario({
            id: scenarioId ?? undefined,
            name: scenarioName,
            baseCellSize: mapDims.baseCellSize,
            width: mapDims.width,
            height: mapDims.height,
            floors,
            paintedCells,
          })
          // The action returns the canonical envelope; the wrapper already
          // surfaced any Zod / domain errors. Only transport or framework
          // failures should land in the catch block now.
          if (!result.success) {
            setAutosaveStatus('error')
            return
          }
          setScenarioId(result.data.id)
          const t = new Date().toLocaleTimeString('es')
          setSavedAt(t)
          setIsDirty(false)
          setAutosaveStatus('saved')
          // Keep the URL in sync with the persisted scenario id so reloads
          // and shared links point at the right place.
          router.replace(`/editor?id=${result.data.id}`)
        } catch {
          setAutosaveStatus('error')
        } finally {
          setIsSaving(false)
        }
      }
      doSave()
    },
    [isDirty, scenarioId, scenarioName, mapDims.baseCellSize, mapDims.width, mapDims.height, floors, paintedCells, router]
  )

  // Periodic autosave. Always on; the tick is a no-op when there's nothing
  // dirty to save.
  useEffect(() => {
    const id = setInterval(() => {
      if (!isDirty) return
      startSaveTransition(() => handleSave(true))
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isDirty, handleSave])

  const paintedInFloor = paintedCells.filter((c) => c.floorId === activeFloorId).length

  const traitMenuNode = useMemo(() => {
    if (!traitMenu) return null
    const cell = paintedCells.find((c) => c.id === traitMenu.cellId)
    if (!cell) return null
    const trait = getInteractiveTrait(
      pieceById.get(cell.pieceId) ?? {
        id: '',
        name: '',
        category: 'other' as const,
        visualStates: [],
        width: 0,
        height: 0,
        tags: [] as string[],
      }
    )
    if (!trait?.getMenu) return null
    return (
      <div style={{ left: traitMenu.position.x, top: traitMenu.position.y, position: 'fixed' }}>
        {trait.getMenu({
          cell,
          onChangeState: handleChangeTraitState,
          onClose: handleCloseTraitMenu,
        })}
      </div>
    )
  }, [traitMenu, paintedCells, pieceById, handleChangeTraitState, handleCloseTraitMenu])

  return (
    <div className={styles.editor}>
      <aside className={styles.paintSidebar}>
        <Link href="/" className={styles.backLink}>
          ← Escenarios
        </Link>
        <PaintToolbar tool={tool} onChange={handleToolChange} />
        <Button type="button" onClick={() => setIsManaging(true)}>
          ⚙ Administrar subdivisions
        </Button>
        <div className={styles.dangerZone}>
          <Button type="button" size="mini" variant="danger" onClick={handleClearAll} disabled={paintedCells.length === 0} title="Borrar TODO el scenario">
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
            disabled={!activeSubdivision || paintedCells.filter((c) => c.floorId === activeFloorId && c.subdivisionId === activeSubdivisionId).length === 0}
            title={activeSubdivision ? `Borrar "${activeSubdivision.name}" de "${activeFloor.name}"` : 'Sin subcapa activa'}
          >
            🗑 Subcapa
          </Button>
          {
            /*canDeleteFloor*/ false ? (
              <Button type="button" size="mini" variant="danger" onClick={handleDeleteFloor} title={`Borrar el piso "${activeFloor.name}" del scenario`}>
                × Eliminar piso
              </Button>
            ) : null
          }
        </div>
        {activeSubdivision ? <PiecePalette pieces={activePieces} activePieceId={activePieceId} onSelect={setActivePieceId} /> : null}
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
            <Button type="button" size="mini" onClick={handleAddFloorBelow} title="Agregar subsuelo (debajo del actual)">
              ↓+
            </Button>
            <Button type="button" size="mini" onClick={handleFloorDown} disabled={activeFloorIndex <= 0} title="Bajar de piso">
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
            <Button type="button" size="mini" onClick={handleAddFloorAbove} title="Agregar piso arriba del actual">
              +↑
            </Button>
            <span className={styles.floorSwitcherDivider} aria-hidden="true" />
          </div>

          <div className={styles.zoomControls}>
            <Button type="button" size="mini" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} title="Reducir zoom">
              −
            </Button>
            <span className={styles.zoomDisplay} aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <Button type="button" size="mini" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} title="Aumentar zoom">
              +
            </Button>
          </div>

          <span className={styles.autosaveStatus} data-status={autosaveStatus} title={`Autoguardado cada ${AUTOSAVE_INTERVAL_MS / 60_000} min`}>
            {autosaveStatus === 'saving' && '⟳ Guardando…'}
            {autosaveStatus === 'saved' && savedAt && `✓ Guardado ${savedAt}`}
            {autosaveStatus === 'error' && '✗ Error al guardar'}
            {autosaveStatus === 'idle' && (savedAt ? `Guardado ${savedAt}` : '○')}
          </span>
          <Button type="button" variant="primary" onClick={() => handleSave(false)} disabled={isSaving}>
            {isSaving ? 'Guardando…' : scenarioId ? 'Guardar' : 'Crear'}
          </Button>
        </header>

        {subdivisions.length > 0 ? (
          <SubdivisionTabs subdivisions={subdivisions} activeId={activeSubdivisionId} onChange={handleSubdivisionChange} onReorder={handleReorder} />
        ) : (
          <Empty>
            No hay subdivisions.{' '}
            <Button type="button" onClick={() => setIsManaging(true)}>
              Crear la primera
            </Button>
          </Empty>
        )}

        <PaintCanvas
          floors={floors}
          activeFloorId={activeFloorId}
          mapDims={mapDims}
          zoom={zoom}
          subdivisions={subdivisions}
          paintedCells={paintedCells}
          pieces={allUsedPieces}
          activeSubdivisionId={activeSubdivisionId}
          activePieceId={activePieceId}
          tool={tool}
          onPaint={handlePaint}
          onOpenTraitMenu={handleOpenTraitMenu}
          overlay={<WeatherOverlay weatherId={weatherState.weatherId} thunderAt={thunderAt} />}
        />
      </main>

      <SubdivisionManager isOpen={isManaging} onClose={handleCloseManager} subdivisions={subdivisions} />

      {traitMenuNode}
    </div>
  )
}
