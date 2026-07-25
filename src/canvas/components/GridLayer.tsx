"use client";

import { Layer, Line } from "react-konva";
import type { GridConfig } from "../grid";
import { gridLines } from "../grid";

type Props = {
  config: GridConfig;
  stroke?: string;
  strokeWidth?: number;
};

export function GridLayer({
  config,
  stroke = "#2a2e36",
  strokeWidth = 1,
}: Props) {
  const lines = gridLines(config);
  return (
    <Layer listening={false}>
      {lines.vertical.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, 0, x, lines.totalHeight]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          perfectDrawEnabled={false}
        />
      ))}
      {lines.horizontal.map((y) => (
        <Line
          key={`h-${y}`}
          points={[0, y, lines.totalWidth, y]}
          stroke={stroke}
          strokeWidth={strokeWidth}
          perfectDrawEnabled={false}
        />
      ))}
    </Layer>
  );
}
