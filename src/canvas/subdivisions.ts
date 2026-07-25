// Subdivision definitions. The list is now minimal because subdivisions
// are editable from the app (see SubdivisionManager).
//
// The "Puertas" subdivision is special: it always exists, holds door
// textures, and is hidden from the regular tab list. Access it via the
// "Puerta" tool in the PaintToolbar.

export const DOORS_SUBDIVISION_NAME = "Puertas";

export const DEFAULT_SUBDIVISION_ID = "doors-painter";

/** Find the subdivision config for the "Puertas" special layer. */
export function isDoorsSubdivision(subdivisionName: string): boolean {
  return subdivisionName === DOORS_SUBDIVISION_NAME;
}

/** Filter out the special "Puertas" subdivision from the regular tab list. */
export function filterVisibleSubdivisions<T extends { name: string }>(
  subdivisions: T[],
): T[] {
  return subdivisions.filter((s) => s.name !== DOORS_SUBDIVISION_NAME);
}
