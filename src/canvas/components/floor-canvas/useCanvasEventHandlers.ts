'use client';

import type Konva from 'konva';
import { useCallback } from 'react';
import type { Piece, PaintedCell, SubdivisionConfig } from '@/lib/shared/types';
import type { BrushCell } from '../../tools';
import { findInteractiveCellAtPixel } from '../../traits';

export type FloorCanvasEvents = {
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: (e: Konva.KonvaEventObject<TouchEvent>) => void;
  onTouchMove: () => void;
  onTouchEnd: () => void;
  onContextMenu: (e: Konva.KonvaEventObject<MouseEvent>) => void;
};

type UseCanvasEventHandlersArgs = {
  stageRef: React.MutableRefObject<Konva.Stage | null>;
  isActive: boolean;
  isSpaceDown: boolean;
  isPanning: boolean;
  isDrawingRef: React.MutableRefObject<boolean>;
  lastStrokeCellRef: React.MutableRefObject<BrushCell | null>;
  apply: (pointer: { x: number; y: number }, isDragging: boolean) => void;
  updateHoverCell: (cell: BrushCell | null) => void;
  beginPan: (clientX: number, clientY: number) => void;
  pointerToCell: (pointer: { x: number; y: number }) => BrushCell | null;
  floorId: string;
  cells: readonly PaintedCell[];
  mapDims: { baseCellSize: number };
  subById: Map<string, SubdivisionConfig>;
  pieceById: Map<string, Piece>;
  onOpenTraitMenu?: (
    cellId: string,
    traitKind: string,
    screenPos: { x: number; y: number },
  ) => void;
};

/**
 * Builds the Konva event handlers for the active floor. Inactive floors
 * short-circuit on every handler so the active floor stays the only hit-test
 * target. The `findInteractiveCellAtPixel` lookup is inlined here so the
 * cell/trait plumbing doesn't leak into the render component.
 */
export function useCanvasEventHandlers(
  args: UseCanvasEventHandlersArgs,
): FloorCanvasEvents {
  const { isActive, isSpaceDown, isPanning, floorId, cells, onOpenTraitMenu } = args;

  const getPointer = useCallback((): { x: number; y: number } | null => {
    const stage = args.stageRef.current;
    if (!stage) return null;
    return stage.getRelativePointerPosition();
  }, [args.stageRef]);

  const onMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isActive) return;
      // Right-click is reserved for opening trait menus (handleContextMenu);
      // it must not start a paint stroke or pan.
      if (e.evt.button === 2) return;
      // Left-click + space: pan.
      if (e.evt.button === 0 && isSpaceDown) {
        e.evt.preventDefault();
        args.beginPan(e.evt.clientX, e.evt.clientY);
        return;
      }
      // Left-click without space: paint or erase.
      if (e.evt.button === 0) {
        const pointer = getPointer();
        if (!pointer) return;
        args.apply(pointer, false);
        args.isDrawingRef.current = true;
      }
    },
    [isActive, isSpaceDown, args, getPointer],
  );

  const onMouseMove = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isActive) return;
      const pointer = getPointer();
      if (!pointer) return;
      // Always update the preview hover position, regardless of draw state —
      // the preview must be visible any time the cursor is over the canvas.
      args.updateHoverCell(args.pointerToCell(pointer));
      // Panning is handled by the window-level listener registered in the
      // viewport hook, so the cursor can leave the stage area without losing
      // the drag.
      if (isPanning) return;
      if (!args.isDrawingRef.current) return;
      args.apply(pointer, true);
    },
    [isActive, isPanning, args, getPointer],
  );

  const onMouseUp = useCallback(() => {
    if (!isActive) return;
    args.isDrawingRef.current = false;
    args.lastStrokeCellRef.current = null;
  }, [isActive, args]);

  const onMouseLeave = useCallback(() => {
    if (!isActive) return;
    args.isDrawingRef.current = false;
    args.lastStrokeCellRef.current = null;
    args.updateHoverCell(null);
  }, [isActive, args]);

  const onTouchStart = useCallback(
    (e: Konva.KonvaEventObject<TouchEvent>) => {
      if (!isActive) return;
      // Single-finger touch pans (consistent with desktop space+drag).
      const t = e.evt.touches[0];
      if (!t) return;
      e.evt.preventDefault();
      args.beginPan(t.clientX, t.clientY);
    },
    [isActive, args],
  );

  const onTouchEnd = useCallback(() => {
    if (!isActive) return;
    // Window-level touchend (registered by the hook) clears the drag ref.
  }, [isActive]);

  // Touchmove handler is intentionally a no-op: paint on touch comes from
  // the single-finger pan drag handled in `onTouchStart`, not from a per-
  // move paint pump. Matches the prior PaintCanvas behaviour.
  const onTouchMove = onTouchEnd;

  const onContextMenu = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isActive) return;
      e.evt.preventDefault();
      if (!onOpenTraitMenu) return;
      const pointer = getPointer();
      if (!pointer) return;
      const found = findInteractiveCellAtPixel({
        cells,
        floorId,
        pixelX: pointer.x,
        pixelY: pointer.y,
        baseCellSize: args.mapDims.baseCellSize,
        subById: args.subById,
        pieceById: args.pieceById,
      });
      if (!found) return;
      onOpenTraitMenu(found.cell.id, found.trait.kind, {
        x: e.evt.clientX,
        y: e.evt.clientY,
      });
    },
    [isActive, onOpenTraitMenu, getPointer, cells, floorId, args],
  );

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onContextMenu,
  };
}
