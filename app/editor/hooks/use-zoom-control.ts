import { useState } from "react";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from "@/lib/shared/constants/map";

export function useZoomControl() {
  const [zoom, setZoom] = useState(1);
  const zoomIn = () => setZoom((value) => Math.min(MAX_ZOOM, +(value + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((value) => Math.max(MIN_ZOOM, +(value - ZOOM_STEP).toFixed(2)));

  return { zoom, zoomIn, zoomOut };
}
