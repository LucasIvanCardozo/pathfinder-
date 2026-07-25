'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { Floor, PaintedCell, Texture, SubdivisionConfig, Door, DoorState } from '@/pieces'
import { findTexture, findTexturesByIds } from '@/assets'
import { DEFAULT_SUBDIVISION_ID, DOORS_SUBDIVISION_NAME, isDoorsSubdivision, doorStateToTextureId, textureIdToState } from '@/canvas'
import { saveScenario } from '../actions/scenarios'
import { reorderSubdivisions } from '../actions/subdivisions'
import { PaintToolbar, SubdivisionTabs, TexturePalette, type PaintTool, useKeyboardShortcuts, filterVisibleSubdivisions } from '@/canvas'
import { SubdivisionManager } from '../components/SubdivisionManager'
import { DoorMenu } from '@/components/DoorMenu'
import './editor.css'
import '../components/subdivision-manager.css'
import '../components/form/form.css'
import '../components/modal.css'
import '../../components/door-menu.css'

const AUTOSAVE_INTERVAL_MS = 60 * 1000

const PaintCanvas = dynamic(() => import('@/canvas/konva').then((m) => m.PaintCanvas), {
  ssr: false,
  loading: () => <div className="canvas-loading">Cargando canvas…</div>,
})

type InitialScenario = {
  id: string
  name: string
  floors: Floor[]
  activeFloorId: string
  paintedCells: PaintedCell[]
  doors: Door[]
}

type Props = {
  initialScenario: InitialScenario | null
  initialSubdivisions: SubdivisionConfig[]
  allTextures: Texture[]
}

function makeDefaultFloor(): Floor {
  return {
    id: generateId('floor'),
    name: 'Planta Baja',
    baseCellSize: 64,
    width: 20,
    height: 14,
  }
}

function generateId(prefix: 'cell' | 'door' | 'floor'): string {
  return `${prefix}-${crypto.randomUUID()}`
}

const generateFloorId = () => generateId('floor')

export function EditorClient({ initialScenario, initialSubdivisions, allTextures }: Props) {
  const router = useRouter()
  const [isSaving, startSaveTransition] = useTransition()

  const [scenarioId, setScenarioId] = useState<string | null>(initialScenario?.id ?? null)
  const [scenarioName, setScenarioName] = useState<string>(initialScenario?.name ?? 'Nuevo escenario')
  const [floors, setFloors] = useState<Floor[]>(initialScenario?.floors ?? [makeDefaultFloor()])
  const [activeFloorId, setActiveFloorId] = useState<string>(initialScenario?.activeFloorId ?? floors[0]?.id ?? '')
  const [paintedCells, setPaintedCells] = useState<PaintedCell[]>(initialScenario?.paintedCells ?? [])
  const [doors, setDoors] = useState<Door[]>(initialScenario?.doors ?? [])
  const [subdivisions, setSubdivisions] = useState<SubdivisionConfig[]>(initialSubdivisions)
  const [isManaging, setIsManaging] = useState(false)
  // True when there are unsaved changes since the last save.
  const [isDirty, setIsDirty] = useState(false)
  const markDirty = useCallback(() => setIsDirty(true), [])

  const [tool, setTool] = useState<PaintTool>('paint')
  const [activeSubdivisionId, setActiveSubdivisionId] = useState<string>(
    initialSubdivisions.find((s) => s.name !== DOORS_SUBDIVISION_NAME)?.id ?? DEFAULT_SUBDIVISION_ID
  )
  const [activeTextureId, setActiveTextureId] = useState<string | null>(null)
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [autosaveEnabled, setAutosaveEnabled] = useState(true)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Door menu state
  const [doorMenu, setDoorMenu] = useState<{
    door: Door
    position: { x: number; y: number }
  } | null>(null)

  const activeFloor = floors.find((f) => f.id === activeFloorId) ?? floors[0]!
  const activeSubdivision = subdivisions.find((s) => s.id === activeSubdivisionId)
  const activeTextures = activeSubdivision ? findTexturesByIds(activeSubdivision.textureIds) : []

  const usedTextureIds = new Set<string>()
  for (const sub of subdivisions) {
    for (const id of sub.textureIds) usedTextureIds.add(id)
  }
  const allUsedTextures = allTextures.filter((t) => usedTextureIds.has(t.id))

  const handlePaint = useCallback(
    (
      floorId: string,
      subdivisionId: string,
      gridX: number,
      gridY: number,
      textureId: string | null,
      screenPos: { x: number; y: number } | null,
      isDragging: boolean
    ) => {
      // The "Puertas" subdivision is special: clicks on it create Door
      // entities instead of PaintedCells.
      const activeSub = subdivisions.find((s) => s.id === subdivisionId)
      markDirty()

      if (tool === 'erase') {
        // Erase the painted cell of the active subdivision (if any).
        setPaintedCells((prev) => prev.filter((c) => !(c.floorId === floorId && c.subdivisionId === subdivisionId && c.gridX === gridX && c.gridY === gridY)))
        // If the active subdivision is "Puertas", also erase the door
        // at this cell (if any). Drag erase hits this branch as well.
        if (activeSub && isDoorsSubdivision(activeSub.name)) {
          setDoors((prev) => prev.filter((d) => !(d.floorId === floorId && d.gridX === gridX && d.gridY === gridY)))
        }
        return
      } else if (activeSub && isDoorsSubdivision(activeSub.name)) {
        let doorTexture = activeTextureId
        if (!doorTexture?.startsWith('door-')) {
          const doorsSub = subdivisions.find((s) => isDoorsSubdivision(s.name))
          if (doorsSub) {
            doorTexture = doorsSub.textureIds.find((id) => id.startsWith('door-')) ?? null
          }
        }
        if (!doorTexture) {
          alert('No hay texturas de puerta disponibles.')
          return
        }
        const existing = doors.find((d) => d.floorId === floorId && d.gridX === gridX && d.gridY === gridY)
        if (existing) {
          const px = screenPos ? screenPos.x + 12 : gridX * activeFloor.baseCellSize
          const py = screenPos ? screenPos.y + 12 : gridY * activeFloor.baseCellSize
          setDoorMenu({
            door: existing,
            position: { x: px, y: py },
          })
          return
        }
        const newDoor: Door = {
          id: generateId('door'),
          scenarioId: scenarioId ?? '',
          floorId,
          textureId: doorTexture,
          gridX,
          gridY,
          state: textureIdToState(doorTexture),
          orientation: 0,
        }
        setDoors((prev) => [...prev, newDoor])
        return
      }
      // From any non-Puertas subdivision, a single-click on a cell
      // that already has a door opens its menu (so the GM can tweak
      // state without switching tabs). Drag-paint ignores doors:
      // paint over the door cell the same as any other cell.
      if (tool === 'paint' && activeSub && !isDoorsSubdivision(activeSub.name) && !isDragging) {
        const existingDoor = doors.find((d) => d.floorId === floorId && d.gridX === gridX && d.gridY === gridY)
        if (existingDoor) {
          const px = screenPos ? screenPos.x + 12 : gridX * activeFloor.baseCellSize
          const py = screenPos ? screenPos.y + 12 : gridY * activeFloor.baseCellSize
          setDoorMenu({
            door: existingDoor,
            position: { x: px, y: py },
          })
          return
        }
      }
      setPaintedCells((prev) => {
        const filtered = prev.filter((c) => !(c.floorId === floorId && c.subdivisionId === subdivisionId && c.gridX === gridX && c.gridY === gridY))
        if (!textureId) return filtered
        return [
          ...filtered,
          {
            id: generateId('cell'),
            floorId,
            subdivisionId,
            gridX,
            gridY,
            textureId,
          },
        ]
      })
    },
    [activeTextureId, activeFloor, doors, subdivisions, tool, markDirty]
  )

  const handleSubdivisionChange = (id: string) => {
    setActiveSubdivisionId(id)
    setActiveTextureId(null)
  }

  const handleSelectDoors = useCallback(() => {
    const doorsSub = subdivisions.find((s) => isDoorsSubdivision(s.name))
    if (!doorsSub) return
    setActiveSubdivisionId(doorsSub.id)
    const firstDoorTexture = doorsSub.textureIds.find((id) => id.startsWith('door-'))
    setActiveTextureId(firstDoorTexture ?? null)
  }, [subdivisions])

  const handleReorder = useCallback(
    async (fromId: string, toId: string, side: 'left' | 'right') => {
      if (fromId === toId) return
      const fromIdx = subdivisions.findIndex((s) => s.id === fromId)
      const toIdx = subdivisions.findIndex((s) => s.id === toId)
      if (fromIdx === -1 || toIdx === -1) return

      // Reorder: pull `from` out, insert it before or after `to`.
      const moved = subdivisions[fromIdx]!
      const without = subdivisions.filter((_, i) => i !== fromIdx)
      const newToIdx = without.findIndex((s) => s.id === toId)
      const insertAt = side === 'left' ? newToIdx : newToIdx + 1
      without.splice(insertAt, 0, moved)

      // Persist new order locally first (instant feedback), then on the server.
      const renumbered = without.map((s, i) => ({ ...s, order: i }))
      setSubdivisions(renumbered)
      markDirty()
      await reorderSubdivisions(renumbered.map((s) => ({ id: s.id, order: s.order })))
    },
    [subdivisions, markDirty]
  )

  // Global keyboard shortcuts. See useKeyboardShortcuts for the contract.
  // Tier 1: B/E tools, D subdivision Puertas, Ctrl/Cmd+S save, Esc close menu.
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
    // Tier 1
    { key: 'b', handler: () => setTool('paint') },
    { key: 'e', handler: () => setTool('erase') },
    { key: 'd', handler: handleSelectDoors },
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
      handler: () => setDoorMenu(null),
    },
    // Tier 2: 1-4 select subdivision by position (visible tabs first, then Puertas).
    // Numbers are 1-indexed so 1=Suelo (or first visible), 2=next, etc.
    ...[1, 2, 3, 4].map((n) => ({
      key: String(n),
      handler: () => {
        const ordered = [...filterVisibleSubdivisions(subdivisions), ...subdivisions.filter((s) => isDoorsSubdivision(s.name))]
        const target = ordered[n - 1]
        if (target) handleSubdivisionChange(target.id)
      },
    })),
    // Tier 2: Shift+ArrowUp/Down change the active floor. Shift avoids the
    // browser's native arrow-key scrolling. ArrowUp = up, ArrowDown = down.
    { key: 'ArrowUp', shift: true, handler: handleFloorUp },
    { key: 'ArrowDown', shift: true, handler: handleFloorDown },
  ])

  const handleCloseManager = async () => {
    setIsManaging(false)
    const fresh = await import('../actions/subdivisions').then((m) => m.listSubdivisions())
    setSubdivisions(fresh)
    if (!fresh.find((s) => s.id === activeSubdivisionId)) {
      setActiveSubdivisionId(fresh[0]?.id ?? DEFAULT_SUBDIVISION_ID)
    }
  }

  const handleChangeDoorState = useCallback(
    (state: DoorState) => {
      if (!doorMenu) return
      const newTextureId = doorStateToTextureId(state)
      setDoors((prev) => prev.map((d) => (d.id === doorMenu.door.id ? { ...d, state, textureId: newTextureId ?? d.textureId } : d)))
      markDirty()
      setDoorMenu(null)
    },
    [doorMenu, markDirty]
  )

  const handleToolChange = (newTool: PaintTool) => {
    setTool(newTool)
  }

  // Naming convention: distance to the Planta Baja determines the name,
  // not the absolute array index. pbIndex is looked up by name because the
  // user might rename floors later.
  const plantaBajaIndex = floors.findIndex((f) => f.name.toLowerCase() === 'planta baja')
  const floorNameForIndex = (index: number): string => {
    if (index === plantaBajaIndex) return 'Planta Baja'
    if (plantaBajaIndex === -1) return `Piso ${index}` // no pb yet, fallback
    if (index < plantaBajaIndex) return `Subsuelo ${plantaBajaIndex - index}`
    return `Piso ${index - plantaBajaIndex}`
  }

  const makeFloor = (): Floor => ({
    id: generateFloorId(),
    name: 'Piso', // overwritten by the caller with the right index
    baseCellSize: activeFloor.baseCellSize,
    width: activeFloor.width,
    height: activeFloor.height,
  })

  const handleAddFloorAbove = () => {
    // Appended at the end → it's the new top floor.
    const newIndex = floors.length
    const newFloor: Floor = { ...makeFloor(), name: floorNameForIndex(newIndex) }
    setFloors((prev) => [...prev, newFloor])
    setActiveFloorId(newFloor.id)
    markDirty()
  }

  const handleAddFloorBelow = () => {
    // Prepended. After prepend, the new floor sits at index 0 and the
    // Planta Baja shifts down by one. Subsuelo N where N = old pbIndex + 1.
    const newN = plantaBajaIndex + 1
    const newFloor: Floor = {
      ...makeFloor(),
      name: `Subsuelo ${newN}`,
    }
    setFloors((prev) => [newFloor, ...prev])
    setActiveFloorId(newFloor.id)
    markDirty()
  }

  // Delete the active floor if it's the topmost or bottommost (but never
  // the Planta Baja — that's the scenario's anchor).
  const isAtTop = activeFloorIndex === floors.length - 1
  const isAtBottom = activeFloorIndex === 0
  const isPlantaBaja = activeFloor.name.toLowerCase() === 'planta baja'
  const canDeleteFloor = floors.length > 1 && !isPlantaBaja && (isAtTop || isAtBottom)

  const handleDeleteFloor = () => {
    if (!canDeleteFloor) return
    if (!confirm(`¿Borrar "${activeFloor.name}"? Las celdas y puertas de este piso se perderán.`)) return
    const idx = activeFloorIndex
    const remaining = floors.filter((_, i) => i !== idx)
    setFloors(remaining)
    // Pick the adjacent floor so the user doesn't end up on a stale id.
    const newIdx = Math.min(idx, remaining.length - 1)
    setActiveFloorId(remaining[newIdx]!.id)
    markDirty()
  }

  // Copy the painted cells + doors of another floor into the active one.
  // Useful for, e.g., duplicating a castle's ground floor up to the next
  // floor so the GM can tweak the upper half without re-painting everything.
  const otherFloors = floors.filter((f) => f.id !== activeFloorId)
  const handleCopyFloorFrom = (sourceFloorId: string) => {
    if (!sourceFloorId) return
    const source = floors.find((f) => f.id === sourceFloorId)
    if (!source) return
    if (!confirm(`¿Copiar "${source.name}" a "${activeFloor.name}"? El contenido actual de "${activeFloor.name}" será reemplazado.`)) return
    // Copy painted cells with regenerated IDs to avoid collisions.
    const newCells = paintedCells.filter((c) => c.floorId === sourceFloorId).map((c) => ({ ...c, id: generateId('cell'), floorId: activeFloorId }))
    const newDoors = doors.filter((d) => d.floorId === sourceFloorId).map((d) => ({ ...d, id: generateId('door'), floorId: activeFloorId }))
    setPaintedCells((prev) => [...prev.filter((c) => c.floorId !== activeFloorId), ...newCells])
    setDoors((prev) => [...prev.filter((d) => d.floorId !== activeFloorId), ...newDoors])
    markDirty()
  }

  const handleClear = () => {
    if (!confirm('¿Borrar todas las celdas pintadas y puertas de este escenario?')) return
    setPaintedCells([])
    setDoors([])
    markDirty()
  }

  const handleSave = useCallback(
    (isAutosave = false) => {
      const doSave = async () => {
        if (isAutosave && !isDirty) return
        setAutosaveStatus('saving')
        try {
          const result = await saveScenario({
            id: scenarioId ?? undefined,
            name: scenarioName,
            floors,
            paintedCells,
            doors,
          })
          setScenarioId(result.id)
          const t = new Date().toLocaleTimeString('es')
          setSavedAt(t)
          setIsDirty(false)
          setAutosaveStatus('saved')
          router.refresh()
        } catch {
          setAutosaveStatus('error')
        }
      }
      doSave()
    },
    [isDirty, scenarioId, scenarioName, floors, paintedCells, doors, router]
  )

  const paintedInFloor = paintedCells.filter((c) => c.floorId === activeFloorId).length
  const doorsInFloor = doors.filter((d) => d.floorId === activeFloorId).length

  return (
    <div className="editor">
      <aside className="paint-sidebar">
        <Link href="/" className="back-link">
          ← Escenarios
        </Link>
        <PaintToolbar tool={tool} onChange={handleToolChange} />
        <button type="button" className="button" onClick={() => setIsManaging(true)}>
          ⚙ Administrar subdivisions
        </button>
        {activeSubdivision ? <TexturePalette textures={activeTextures} activeTextureId={activeTextureId} onSelect={setActiveTextureId} /> : null}
      </aside>

      <main className="canvas-area">
        <header className="canvas-header">
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            className="scenario-name-input"
            placeholder="Nombre del escenario"
          />
          <div className="floor-switcher">
            <button type="button" className="button mini" onClick={handleAddFloorBelow} title="Agregar subsuelo (debajo del actual)">
              -
            </button>
            <button type="button" className="button mini" onClick={handleFloorDown} disabled={activeFloorIndex <= 0} title="Bajar de piso">
              ↓
            </button>
            <span className="floor-current" title={activeFloor.name}>
              {activeFloor.name}
            </span>
            <button
              type="button"
              className="button mini"
              onClick={handleFloorUp}
              disabled={activeFloorIndex < 0 || activeFloorIndex >= floors.length - 1}
              title="Subir de piso"
            >
              ↑
            </button>
            <button type="button" className="button mini" onClick={handleAddFloorAbove} title="Agregar piso arriba del actual">
              +
            </button>
            <span className="floor-switcher-divider" aria-hidden="true" />
            {canDeleteFloor ? (
              <button type="button" className="button mini danger" onClick={handleDeleteFloor} title={`Borrar ${activeFloor.name}`}>
                ×
              </button>
            ) : null}
          </div>
          <span className="canvas-stat">
            {paintedInFloor} celdas · {doorsInFloor} puertas
          </span>
          <span className="canvas-stat">
            Grilla {activeFloor.width}×{activeFloor.height} · {activeFloor.baseCellSize}px
          </span>
          <span
            className="autosave-status"
            data-status={autosaveStatus}
            title={autosaveEnabled ? `Autoguardado cada ${AUTOSAVE_INTERVAL_MS / 60_000} min` : 'Autoguardado desactivado'}
          >
            {autosaveStatus === 'saving' && '⟳ Guardando…'}
            {autosaveStatus === 'saved' && savedAt && `✓ Guardado ${savedAt}`}
            {autosaveStatus === 'error' && '✗ Error al guardar'}
            {autosaveStatus === 'idle' && (savedAt ? `Guardado ${savedAt}` : '○')}
          </span>
          <button
            type="button"
            className={`button mini ${autosaveEnabled ? 'active' : ''}`}
            onClick={() => setAutosaveEnabled((v) => !v)}
            title={autosaveEnabled ? 'Desactivar autoguardado' : 'Activar autoguardado'}
          >
            {autosaveEnabled ? 'Autoguardado ON' : 'Autoguardado OFF'}
          </button>
          <button type="button" className="button danger" onClick={handleClear} disabled={paintedCells.length === 0 && doors.length === 0}>
            Limpiar
          </button>
          <button type="button" className="button primary" onClick={() => handleSave(false)} disabled={isSaving}>
            {isSaving ? 'Guardando…' : scenarioId ? 'Guardar' : 'Crear'}
          </button>
        </header>

        {subdivisions.length > 0 ? (
          <SubdivisionTabs subdivisions={subdivisions} activeId={activeSubdivisionId} onChange={handleSubdivisionChange} onReorder={handleReorder} />
        ) : (
          <p className="empty">
            No hay subdivisions.{' '}
            <button type="button" className="button" onClick={() => setIsManaging(true)}>
              Crear la primera
            </button>
          </p>
        )}

        <PaintCanvas
          floors={floors}
          activeFloorId={activeFloorId}
          subdivisions={subdivisions}
          paintedCells={paintedCells}
          doors={doors}
          textures={allUsedTextures}
          activeSubdivisionId={activeSubdivisionId}
          activeTextureId={activeTextureId}
          tool={tool}
          onPaint={handlePaint}
        />
      </main>

      <SubdivisionManager isOpen={isManaging} onClose={handleCloseManager} subdivisions={subdivisions} allTextures={allTextures} />

      {doorMenu ? <DoorMenu door={doorMenu.door} position={doorMenu.position} onChangeState={handleChangeDoorState} onClose={() => setDoorMenu(null)} /> : null}
    </div>
  )
}
