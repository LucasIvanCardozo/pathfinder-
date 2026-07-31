/**
 * Barrel for the application-wide constants. Each concern lives in its own
 * file under `lib/shared/constants/` and is re-exported here so callers can
 * import everything they need from a single path:
 *
 *   import {
 *     MAP,
 *     SUBDIVISIONS,
 *     DEFAULT_FLOOR_NAMES,
 *     MIN_BRUSH_SIZE,
 *     WEATHER_DEFAULT,
 *     AUTOSAVE_INTERVAL_MS,
 *   } from '@/lib/shared/constants';
 *
 * The sub-files are intentionally small and single-purpose so each one can
 * be edited (or its values tweaked in a config UI later) without spelunking
 * through the codebase.
 */
export * from './brush';
export * from './floors';
export * from './image-pipeline';
export * from './keyboard';
export * from './map';
export * from './perf';
export * from './shortcuts';
export * from './subdivisions';
export * from './timing';
export * from './validation';
export * from './weather';