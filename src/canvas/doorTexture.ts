// Helpers for working with doors. Kept in a separate file so the canvas
// components don't need to know about DB-layer details.

import type { DoorState } from "@/pieces";

const DOOR_TEXTURE_IDS: Record<DoorState, string> = {
  open: "door-open",
  closed: "door-closed",
  locked: "door-locked",
};

/** Map a DoorState to the texture id used to render it. */
export function doorStateToTextureId(state: DoorState): string {
  return DOOR_TEXTURE_IDS[state];
}

/** Map a texture id back to its DoorState, by stripping the "door-" prefix
 *  and using the resulting word as the state name. Falls back to "closed". */
export function textureIdToState(textureId: string): DoorState {
  const withoutPrefix = textureId.replace(/^door-/, "");
  if (withoutPrefix === "open" || withoutPrefix === "closed" || withoutPrefix === "locked") {
    return withoutPrefix;
  }
  return "closed";
}

const DOOR_LABELS: Record<DoorState, string> = {
  open: "Abierta",
  closed: "Cerrada",
  locked: "Bloqueada",
};

export const ALL_DOOR_STATES: DoorState[] = ["open", "closed", "locked"];

/** Human-readable label for a door state. */
export function doorStateLabel(state: DoorState): string {
  return DOOR_LABELS[state];
}
