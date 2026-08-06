'use client';

import { Group, Layer, Rect, Text } from 'react-konva';
import type { ScenarioEffect } from '@/lib/shared/types';
import type { SpellTemplate } from '../effects/spell-templates';

/** Grid-space cell used by the renderer. Decoupled from `EffectMarkerCell`
 *  so the EffectsLayer does not depend on the hook's internal type. */
export interface EffectsLayerCell {
  gridX: number;
  gridY: number;
}

/**
 * Marker contract: one entry per effect plus its filtered cell set and the
 * resolved template. `visibleCells` are pre-computed by `useEffectMarkers`
 * (wall-aware BFS). `blockedByWall: true` means the renderer should fall
 * back to the vignette at the anchor instead of the per-cell `<Rect>` loop.
 */
export interface EffectsLayerMarker {
  effect: ScenarioEffect;
  visibleCells: readonly EffectsLayerCell[];
  template: SpellTemplate;
  anchor: { gridX: number; gridY: number };
  blockedByWall: boolean;
}

interface EffectsLayerProps {
  markers: readonly EffectsLayerMarker[];
  /** Cell size for the spell marker render. Spells live in obscured-space
   *  (cellSizeRatio 1) so this is always `baseCellSize` regardless of the
   *  active subdivision. */
  spellCellSize: number;
}

/** 16x16 px clock-strikethrough vignette drawn at the anchor when the
 *  wall-aware BFS emptied the footprint. The anchor cell exists in every
 *  scenario row, so the position is always valid. */
const BLOCKED_EMOJI = '🕓';
const BLOCKED_OPACITY = 0.6;
/** Footprint tint. Lives on the per-cell rect (not the parent group) so the
 *  anchor-cell counter keeps full opacity — Konva groups propagate opacity
 *  to every child, so a group-level 0.35 would fade the digits too. */
const FOOTPRINT_OPACITY = 0.35;

/**
 * Renders all spell markers as a single Konva Layer. Each effect is
 * wrapped in a `<Konva.Group>` so the per-cell `<Rect>` elements can be
 * `listening={false}` — Konva collapses the whole effect into one draw call.
 *
 * The Group has no onClick/onTap handler: clicks on markers are intentionally
 * a no-op. Spells are removed only by the `endCombat` cascade
 * (`effectRepository.purgeOrphansInTx`) or by the per-round tick that
 * decrements `durationRounds` to zero. The Group still cancels mousedown
 * bubble so the Stage's `onMouseDown` doesn't fire `onPlaceSpell` on top
 * of an existing marker (see `useCanvasEventHandlers`).
 *
 * When the wall-aware BFS reports `blockedByWall: true` for a marker, the
 * renderer skips the per-cell `<Rect>` loop and draws a small clock icon
 * at the anchor cell instead.
 *
 * The component ALWAYS renders a `<Layer>` (even with zero markers) so the
 * per-canvas `:nth-child` filters in `floor-canvas.module.css` stay aligned
 * with the documented DOM order. Returning `null` on an empty marker set
 * would skip the canvas and shift the obscured / brush-preview layers into
 * the wrong slots — the brush preview would pick up the `filter: blur(10px)`
 * intended for the obscured layer. The empty Layer is a no-op visually
 * (Konva draws nothing) but keeps the slot reserved.
 */
export function EffectsLayer({ markers, spellCellSize }: EffectsLayerProps) {
  return (
    <Layer>
      {markers.map(({ effect, visibleCells, template, anchor, blockedByWall }) => (
        <Group
          key={effect.id}
          listening={false}
          onMouseDown={(e) => {
            // Stage.onMouseDown dispatches the `effects` tool branch
            // (places a new spell at the click cell). The Group must
            // cancel the event here or every click on an existing
            // marker would stack a second spell on top of it.
            e.cancelBubble = true;
          }}
        >
          {blockedByWall ? (
            <Text
              x={anchor.gridX * spellCellSize}
              y={anchor.gridY * spellCellSize}
              width={spellCellSize}
              height={spellCellSize}
              align="center"
              verticalAlign="middle"
              fontSize={Math.min(16, spellCellSize)}
              text={BLOCKED_EMOJI}
              opacity={BLOCKED_OPACITY}
              listening={false}
            />
          ) : (
            visibleCells.map((cell) => (
              <Rect
                key={`${cell.gridX}-${cell.gridY}`}
                x={cell.gridX * spellCellSize}
                y={cell.gridY * spellCellSize}
                width={spellCellSize}
                height={spellCellSize}
                fill={template.color}
                opacity={FOOTPRINT_OPACITY}
                perfectDrawEnabled={false}
                listening={false}
              />
            ))
          )}
          {/*
            Anchor-cell duration counter. Paints `effect.durationRounds` on
            top of the footprint (or the blocked vignette) so the GM always
            sees remaining rounds. The opacity is kept on the cell rects and
            the emoji, NOT on the counter — Konva groups propagate opacity
            to every child, so a group-level 0.35 would fade the digits
            into the template colour. White fill + dark stroke keeps the
            label legible over any template colour; `strokeScaleEnabled={false}`
            pins the stroke to 1px even at high zoom levels.
          */}
          <Text
            x={anchor.gridX * spellCellSize}
            y={anchor.gridY * spellCellSize}
            width={spellCellSize}
            height={spellCellSize}
            align="center"
            verticalAlign="middle"
            fontSize={Math.min(28, spellCellSize * 0.7)}
            fontStyle="bold"
            fill="#fff"
            stroke="#000"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            text={String(effect.durationRounds)}
            listening={false}
          />
        </Group>
      ))}
    </Layer>
  );
}
