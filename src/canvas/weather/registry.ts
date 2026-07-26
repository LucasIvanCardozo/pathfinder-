// Registry of available weathers. Adding a new weather is a 1-line entry here
// plus (optionally) a new effect component referenced by `animation` and/or
// a tint overlay referenced by `tint`.
//
// Audio files expected (drop into `public/sounds/`):
//   - rain.mp3    (loop de lluvia)
//   - storm.mp3   (loop de lluvia más agresivo para tormenta)
//   - thunder.mp3 (trueno único ~3-5 s, disparado aleatoriamente en tormenta)
//
// Conventions:
//   - `sunny` is always the default; `animation: null`, `tint: null`, `sound: null`.
//   - `animation` is the key into the WeatherOverlay dispatcher.
//   - `sound` is one or more sound specs (see `WeatherSound`); null = no audio.
//   - `tint` is a translucent color overlay above the canvas; null = none.

export type WeatherAnimationKind = "rain" | "fog" | "snow" | "storm";

export type WeatherSound = {
  src: string;
  /**
   * - "loop": plays the file continuously while the weather is active.
   * - "random": plays the file once at a random interval. Useful for
   *   non-looping effects like thunder. The next play is scheduled
   *   after the current one finishes.
   */
  mode: "loop" | "random";
  /** Range in ms between random triggers. Defaults to [8_000, 25_000]. */
  intervalMs?: [number, number];
};

export type WeatherDef = {
  id: string;
  label: string;
  animation: WeatherAnimationKind | null;
  sound: WeatherSound | WeatherSound[] | null;
  /** CSS color used as a translucent overlay above the canvas. */
  tint: string | null;
};

export const WEATHERS: readonly WeatherDef[] = [
  { id: "sunny", label: "Soleado", animation: null, sound: null, tint: null },
  { id: "rain", label: "Lluvia", animation: "rain", sound: { src: "/sounds/rain.mp3", mode: "loop" }, tint: "rgba(150, 175, 200, 0.18)" },
  { id: "fog", label: "Niebla", animation: "fog", sound: null, tint: "rgba(220, 220, 225, 0.28)" },
  {
    id: "storm",
    label: "Tormenta",
    animation: "storm",
    sound: [
      { src: "/sounds/rain.mp3", mode: "loop" },
      { src: "/sounds/thunder.mp3", mode: "random", intervalMs: [8_000, 25_000] },
    ],
    tint: "rgba(70, 75, 90, 0.35)",
  },
  { id: "night", label: "Noche", animation: null, sound: null, tint: "rgba(20, 25, 40, 0.55)" },
  { id: "snow", label: "Nieve", animation: "snow", sound: null, tint: "rgba(240, 245, 255, 0.20)" },
] as const;

export function getWeather(id: string): WeatherDef {
  return WEATHERS.find((w) => w.id === id) ?? WEATHERS[0]!;
}
