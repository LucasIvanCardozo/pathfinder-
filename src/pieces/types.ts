// Core domain types for the Pathfinder battle map editor.

export const PIECE_CATEGORIES = [
  "wall",
  "floor",
  "door",
  "water",
  "lava",
  "decoration",
  "other",
] as const;

export type PieceCategory = (typeof PIECE_CATEGORIES)[number];

/** A visual state of a piece. Most pieces have just one ("default"), but
 *  objects like doors have several ("closed" | "open" | "locked"). */
export type VisualState = {
  /** Unique within the parent piece, e.g. "closed", "open", "default". */
  id: string;
  /** Public path served by Next.js. */
  imagePath: string;
  /** True for the visual state used when the piece is freshly painted. */
  isDefault?: boolean;
};

export type TextureTrait = import("./traits").TextureTrait;
export type EntityState = import("./traits").EntityState;

/**
 * A piece is something the GM can paint into a floor cell. It groups one or
 * more visual states under a single id/name, plus optional behaviour traits.
 *
 * Examples:
 *   { id: "floor-stone", name: "Suelo de piedra",
 *     visualStates: [{ id: "default", imagePath: ".../stone.svg" }] }
 *
 *   { id: "door", name: "Puerta",
 *     visualStates: [
 *       { id: "closed", imagePath: ".../door-closed.svg", isDefault: true },
 *       { id: "open",   imagePath: ".../door-open.svg" },
 *       { id: "locked", imagePath: ".../door-locked.svg" },
 *     ],
 *     traits: [{ kind: "door-states" }] }
 */
export type Piece = {
  id: string;
  name: string;
  category: PieceCategory;
  visualStates: readonly VisualState[];
  tags: string[];
  /** Width of the default visual state (for the catalog/UI). */
  width: number;
  height: number;
  /**
   * Optional traits that attach behaviour to this piece (door-states,
   * blocks-light, ...). See `src/pieces/traits.ts` for the full list.
   */
  traits?: readonly TextureTrait[];
};

/**
 * Backwards-compat alias. Many call sites still use `Texture`; we keep the
 * name working until the rename is complete.
 * @deprecated use `Piece` instead.
 */
export type Texture = Piece;

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Subdivision configs are GLOBAL — every floor in
 * every scenario shares the same set. They are stored in the database and
 * can be managed at runtime via the admin UI.
 */
export type SubdivisionConfig = {
  id: string;
  name: string;
  /** List of piece ids that this subdivision can use. */
  pieceIds: string[];
  /** Divisor of the floor's baseCellSize. */
  cellSizeRatio: number;
  /** Z-order (0 = bottom). Higher renders on top. */
  order: number;
};

/**
 * A painted cell represents one cell of one subdivision that has a piece
 * applied. Empty cells are not stored.
 */
export type PaintedCell = {
  id: string;
  floorId: string;
  subdivisionId: string;
  /** Coordinates in the subdivision's grid (not in floor pixels). */
  gridX: number;
  gridY: number;
  /** The piece painted here (e.g. "floor-stone", "door"). */
  pieceId: string;
  /**
   * Mutable state attached to this cell by its piece's traits. Keys are
   * trait kinds (e.g. "door-states" → "closed" | "open" | "locked").
   */
  entityState?: EntityState;
};

export type Floor = {
  id: string;
  name: string;
  baseCellSize: number;
  width: number;
  height: number;
};

export type Scenario = {
  id: string;
  name: string;
  floors: Floor[];
  activeFloorId: string;
  paintedCells: PaintedCell[];
};

export const DOOR_STATES = ["open", "closed", "locked"] as const;
export type DoorState = (typeof DOOR_STATES)[number];