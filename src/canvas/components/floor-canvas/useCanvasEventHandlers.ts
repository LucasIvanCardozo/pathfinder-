'use client';

import type Konva from 'konva';
import { useCallback } from 'react';
import type { Piece, PaintedCell, SubdivisionConfig } from '@/lib/shared/types';
import type { BrushCell, ToolKind } from '../../tools';
import { findInteractiveCellAtPixel } from '../../traits';
import type { SpellTemplateId } from '../../effects/spell-templates';

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
  isPanDown: boolean;
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
  /** PR 2: triggered when the user clicks an empty cell with the `effects`
   *  tool active. The Stage's onMouseDown dispatches this when the tool is
   *  `effects` AND the click did not hit a marker (the marker Rect listens
   *  for its own click and stops the bubble). The parent translates it
   *  into a `pushAddEffect` (or ignores it if no template is selected). */
  onPlaceSpell?: (cell: { gridX: number; gridY: number }) => void;
  /** Current tool so the handler can dispatch on `tool === 'effects'`. */
  tool?: ToolKind;
  /** PR Y: currently-selected spell template id (or `null`). Used by the
   *  context-menu handler to rotate the preview 90° on right-click when
   *  a cone is selected. */
  selectedSpellTemplateId?: SpellTemplateId | null;
  /** PR Y: callback fired by the context-menu handler when the user
   *  right-clicks with the `effects` tool and a rotation-eligible
   *  template selected. The parent rotates the rotation state. */
  onRotateSpell?: () => void;
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
  const { isActive, isPanDown, isPanning, floorId, cells, onOpenTraitMenu } = args;

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
      if (e.evt.button === 0 && isPanDown) {
        e.evt.preventDefault();
        args.beginPan(e.evt.clientX, e.evt.clientY);
        return;
      }
      // Left-click without space: paint, erase, or `effects` tool.
      if (e.evt.button === 0) {
        const pointer = getPointer();
        if (!pointer) return;
        // PR 2: the `effects` tool short-circuits paint/erase. The marker
        // Rect's onClick handler cancelled the bubble if the click landed
        // on a marker, so this branch only fires for empty cells. We
        // forward the active-subdivision cell to the parent so the modal
        // can pre-fill the anchor.
        if (args.tool === 'effects') {
          // If the click landed on a marker Group, skip placement — the
          // Group's onClick handler opens the tooltip. We don't rely on
          // `e.cancelBubble` alone (racey with react-konva's listener
          // registration) nor on `e.target === stage` (clicks on empty
          // cells land on a Layer's canvas, not the Stage itself).
          // Checking `getType() === 'Group'` is the precise path: every
          // marker is wrapped in a Group inside EffectsLayer; Layers,
          // Rects, and the Stage are not Groups so they fall through.
          if (e.target.getType() === 'Group') return;
          const cell = args.pointerToCell(pointer);
          if (cell && args.onPlaceSpell) {
            args.onPlaceSpell(cell);
          }
          return;
        }
        args.apply(pointer, false);
        args.isDrawingRef.current = true;
      }
    },
    [isActive, isPanDown, args, getPointer],
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
      // PR Y: right-click rotates the spell preview 90° when the `effects`
      // tool is active and a spell template is selected. Fall through to the
      // trait-menu flow when the gate doesn't match so piece clicks (doors,
      // chests, etc.) keep working in any tool.
      if (args.tool === 'effects' && args.selectedSpellTemplateId && args.onRotateSpell) {
        args.onRotateSpell();
        return;
      }
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
