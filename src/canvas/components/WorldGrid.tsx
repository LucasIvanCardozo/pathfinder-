'use client';

import { Layer, Line, Stage } from 'react-konva';
import { type GridConfig, gridLines } from '../grid';

type Props = {
  mapDims: { baseCellSize: number; width: number; height: number };
  viewportSize: { width: number; height: number };
  pan: { x: number; y: number };
  zoom: number;
  /**
   * Visible world rect for grid-line culling. Optional; when omitted, the
   * full world grid is generated.
   */
  worldBounds: { x: number; y: number; width: number; height: number } | null;
  stroke?: string;
  strokeWidth?: number;
};

const DEFAULT_STROKE = '#2a2e36';

/**
 * Single-instanced grid overlay for the entire floor stack. Renders the
 * world grid as its own Konva `Stage` so it sits on top of all `FloorCanvas`
 * instances and shares the same pan/zoom transform.
 *
 * Always `listening={false}` — grid lines must never intercept pointer
 * events, otherwise they'd swallow paint strokes.
 */
export function WorldGrid({
  mapDims,
  viewportSize,
  pan,
  zoom,
  worldBounds,
  stroke = DEFAULT_STROKE,
  strokeWidth = 1,
}: Props) {
  const config: GridConfig = {
    worldBaseCellSize: mapDims.baseCellSize,
    width: mapDims.width,
    height: mapDims.height,
    worldBounds: worldBounds ?? undefined,
  };
  const lines = gridLines(config);
  const totalWidth = mapDims.width * mapDims.baseCellSize;
  const totalHeight = mapDims.height * mapDims.baseCellSize;

  return (
    <Stage
      width={Math.max(1, viewportSize.width)}
      height={Math.max(1, viewportSize.height)}
      scaleX={zoom}
      scaleY={zoom}
      x={pan.x}
      y={pan.y}
      listening={false}
    >
      <Layer listening={false}>
        {lines.vertical.map((x) => (
          <Line
            key={`v-${x}`}
            points={[x, 0, x, totalHeight]}
            stroke={stroke}
            strokeWidth={strokeWidth}
            perfectDrawEnabled={false}
          />
        ))}
        {lines.horizontal.map((y) => (
          <Line
            key={`h-${y}`}
            points={[0, y, totalWidth, y]}
            stroke={stroke}
            strokeWidth={strokeWidth}
            perfectDrawEnabled={false}
          />
        ))}
      </Layer>
    </Stage>
  );
}
