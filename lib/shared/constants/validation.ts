/**
 * Centralised validation limits for Zod schemas. Schemas import these so the
 * editor's input bounds and the runtime validators agree on what counts as
 * valid. Bumping any limit below is a one-line change here; the schemas
 * (and therefore the server actions and the editor inputs) pick it up
 * automatically.
 */

export const SCENARIO_LIMITS = Object.freeze({
  NAME_MAX: 200,
  BASE_CELL_SIZE: { MIN: 10, MAX: 200 },
  DIMENSION: { MIN: 1, MAX: 500 },
});

export const FLOOR_LIMITS = Object.freeze({
  NAME_MAX: 100,
});

export const SUBDIVISION_LIMITS = Object.freeze({
  NAME_MAX: 100,
  CELL_SIZE_RATIO: { MIN: 1, MAX: 64 },
  ORDER: { MIN: 0, MAX: 20 },
});

export const PIECE_LIMITS = Object.freeze({
  NAME_MAX: 100,
  DIMENSION: { MIN: 1, MAX: 2048 },
  TAG_MAX_LEN: 40,
});
