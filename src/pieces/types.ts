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

/**
 * A reusable texture tile that can be painted into individual cells of a
 * subdivision. Textures live in the codebase and are referenced by id.
 */
export type Texture = {
  id: string;
  name: string;
  imagePath: string;
  width: number;
  height: number;
  category: PieceCategory;
  tags: string[];
};

/**
 * A subdivision config describes one kind of layer inside a floor (ground,
 * objects, walls, etc.). Subdivision configs are GLOBAL — every floor in
 * every scenario shares the same set. They are stored in the database and
 * can be managed at runtime via the admin UI.
 */
export type SubdivisionConfig = {
  id: string;
  name: string;
  /** Explicit list of texture ids that this subdivision can use. */
  textureIds: string[];
  /** Divisor of the floor's baseCellSize. */
  cellSizeRatio: number;
  /** Z-order (0 = bottom). Higher renders on top. */
  order: number;
};

/**
 * A painted cell represents one cell of one subdivision that has a texture
 * applied. Empty cells are not stored.
 */
export type PaintedCell = {
  id: string;
  floorId: string;
  subdivisionId: string;
  /** Coordinates in the subdivision's grid (not in floor pixels). */
  gridX: number;
  gridY: number;
  textureId: string;
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
  doors: Door[];
};

/**
 * Door state. Maps to a texture variant in the door texture set.
 * - open:    door is open (visible opening)
 * - closed:  standard closed door
 * - locked:  locked (typically with a key requirement)
 * - secret:  hidden / not visible until discovered
 * - broken:  smashed open (destructible variant)
 */
export const DOOR_STATES = ["open", "closed", "locked"] as const;
export type DoorState = (typeof DOOR_STATES)[number];

export type Door = {
  id: string;
  scenarioId: string;
  floorId: string;
  /** Base texture id (e.g. "door-closed"). The actual rendered texture
   *  depends on the current state — see DOOR_TEXTURE_BY_STATE. */
  textureId: string;
  gridX: number;
  gridY: number;
  state: DoorState;
  /** 0 = horizontal, 1 = vertical (for rotation). Future use. */
  orientation: number;
};
