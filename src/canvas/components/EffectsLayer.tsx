'use client';

import { Group, Layer, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ScenarioEffect } from '@/lib/shared/types';

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
  template: { shape: 'cone' | 'circle'; color: string };
  anchor: { gridX: number; gridY: number };
  blockedByWall: boolean;
}

interface EffectsLayerProps {
  markers: readonly EffectsLayerMarker[];
  activeCellSize: number;
  onMarkerClick?: (effectId: string, pointer: { x: number; y: number }) => void;
}

/** 16x16 px clock-strikethrough vignette drawn at the anchor when the
 *  wall-aware BFS emptied the footprint. The anchor cell exists in every
 *  scenario row, so the position is always valid. */
const BLOCKED_EMOJI = '🕓';
const BLOCKED_OPACITY = 0.6;

/**
 * Renders all spell markers as a single Konva Layer. Each effect is
 * wrapped in a `<Konva.Group>` with one onClick/onTap handler so the
 * per-cell `<Rect>` elements can be `listening={false}` — Konva collapses
 * the whole effect into one draw call.
 *
 * When the wall-aware BFS reports `blockedByWall: true` for a marker, the
 * renderer skips the per-cell `<Rect>` loop and draws a small clock icon
 * at the anchor cell instead.
 */
export function EffectsLayer({ markers, activeCellSize, onMarkerClick }: EffectsLayerProps) {
  if (markers.length === 0) return null;
  const handleMarkerEvent = (e: KonvaEventObject<MouseEvent | TouchEvent>, effectId: string) => {
    if (!onMarkerClick) return;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    onMarkerClick(effectId, { x: pointer.x, y: pointer.y });
  };
  return (
    <Layer>
      {markers.map(({ effect, visibleCells, template, anchor, blockedByWall }) => (
        <Group
          key={effect.id}
          opacity={0.35}
          listening
          onClick={(e) => {
            handleMarkerEvent(e, effect.id);
            e.cancelBubble = true;
          }}
          onTap={(e) => {
            handleMarkerEvent(e, effect.id);
            e.cancelBubble = true;
          }}
        >
          {blockedByWall ? (
            <Text
              x={anchor.gridX * activeCellSize}
              y={anchor.gridY * activeCellSize}
              width={activeCellSize}
              height={activeCellSize}
              align="center"
              verticalAlign="middle"
              fontSize={Math.min(16, activeCellSize)}
              text={BLOCKED_EMOJI}
              opacity={BLOCKED_OPACITY}
              listening={false}
            />
          ) : (
            visibleCells.map((cell) => (
              <Rect
                key={`${cell.gridX}-${cell.gridY}`}
                x={cell.gridX * activeCellSize}
                y={cell.gridY * activeCellSize}
                width={activeCellSize}
                height={activeCellSize}
                fill={template.color}
                perfectDrawEnabled={false}
                listening={false}
              />
            ))
          )}
        </Group>
      ))}
    </Layer>
  );
}
