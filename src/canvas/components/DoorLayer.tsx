"use client";

import { memo } from "react";
import { Image as KonvaImage, Layer } from "react-konva";
import type { Door, Texture } from "@/pieces";
import { doorStateToTextureId } from "../doorTexture";
import { useTextureImages } from "../useTextureImages";

type Props = {
  doors: Door[];
  cellSize: number;
  baseTextures: Texture[];
};

/**
 * Renders Door entities on top of the painted-cell layers. Pure render:
 * no event handlers, no hit-testing. All clicks are owned by the Stage
 * and routed through `handlePaint`, exactly like the painted-cell Layers.
 */
function DoorLayerImpl({ doors, cellSize, baseTextures }: Props) {
  const images = useTextureImages(baseTextures);

  return (
    <Layer listening={false}>
      {doors.map((door) => {
        const textureId = doorStateToTextureId(door.state);
        const img = images.get(textureId);
        if (!img) return null;
        return (
          <KonvaImage
            key={door.id}
            image={img}
            x={door.gridX * cellSize}
            y={door.gridY * cellSize}
            width={cellSize}
            height={cellSize}
            listening={false}
          />
        );
      })}
    </Layer>
  );
}

export const DoorLayer = memo(DoorLayerImpl);
