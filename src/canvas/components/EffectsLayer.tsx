'use client';

import { Group, Layer, Rect } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ScenarioEffect } from '@/lib/shared/types';

/** Grid-space cell used by the renderer. Decoupled from `EffectMarkerCell`
 *  so the EffectsLayer does not depend on the hook's internal type. */
export interface EffectsLayerCell {
  gridX: number;
  gridY: number;
}

/**
 * Marker contract: one entry per effect plus its filtered cell set. The
 * `visibleCells` are pre-computed by `useEffectMarkers` (wall-aware BFS) and
 * already exclude any effect the GM has dismissed client-side.
 */
export interface EffectsLayerMarker {
  effect: ScenarioEffect;
  visibleCells: readonly EffectsLayerCell[];
}

interface EffectsLayerProps {
  markers: readonly EffectsLayerMarker[];
  activeCellSize: number;
  onMarkerClick?: (effectId: string, pointer: { x: number; y: number }) => void;
}

/**
 * Renders all AoE markers as a single Konva Layer. Each effect is wrapped in
 * a `<Konva.Group>` with one onClick/onTap handler so the per-cell `<Rect>`
 * elements can be `listening={false}` — Konva collapses the whole effect into
 * one draw call.
 *
 * Cap 0.7 (post-render alpha) is applied by `resultingAlpha` in
 * `src/canvas/effects/footprint.ts` (PR 4 wires the per-cell composite).
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
      {markers.map(({ effect, visibleCells }) => (
        <Group
          key={effect.id}
          opacity={effect.expired ? 0.15 : 0.35}
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
          {visibleCells.map((cell) => (
            <Rect
              key={`${cell.gridX}-${cell.gridY}`}
              x={cell.gridX * activeCellSize}
              y={cell.gridY * activeCellSize}
              width={activeCellSize}
              height={activeCellSize}
              fill={effect.color}
              perfectDrawEnabled={false}
              listening={false}
            />
          ))}
        </Group>
      ))}
    </Layer>
  );
}
