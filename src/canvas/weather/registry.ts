// Registry of available weathers. Adding a new weather is a 1-line entry here
// plus (optionally) a new effect component referenced by `animation` and/or
// a tint overlay referenced by `tint`. Each entry also declares its audio
// (`sound`) — one or more `WeatherSound` records — so the audio system has a
// single source of truth.
//
// Expected audio files in `public/sounds/`:
//   - sunny.mp3      loop 60-90s   ambiente diurno: brisa, pájaros lejanos
//   - rain.mp3       loop 30-60s   lluvia suave
//   - fog.mp3        loop 60-120s  ambiente brumoso
//   - storm_rain.mp3 loop 30-60s   lluvia intensa (loop base de tormenta)
//   - thunder.mp3    one-shot      trueno individual, disparado random en tormenta
//   - night.mp3      loop 90-120s  grillos, búhos ocasionales
//   - snow.mp3       loop 60-90s   viento helado, crujidos
//
// Conventions:
//   - `sunny` is always the default; animation=null, tint=null, sound=non-null
//     (an ambient day requires some breeze/birds or it feels dead).
//   - `animation` is the key into the WeatherOverlay dispatcher (or storm
//     which has its own branch there because it needs `thunderAt`).
//   - `sound` is one or more sound specs (see `WeatherSound`); null = no audio.
//   - `tint` is a translucent color overlay above the canvas; null = none.

export type WeatherAnimationKind = 'rain' | 'fog' | 'snow' | 'storm' | 'night';

export type WeatherSound = {
  src: string;
  /**
   * - "loop": plays the file continuously while the weather is active.
   * - "random": plays the file once at a random interval. Useful for
   *   non-looping effects like thunder. The next play is scheduled
   *   after the current one finishes.
   */
  mode: 'loop' | 'random';
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
  // Audio files expected (drop into `public/sounds/`):
  //   - sunny.mp3      (loop 60-90s   ambiente diurno: brisa, pájaros lejanos)
  //   - rain.mp3       (loop 30-60s   lluvia suave)
  //   - fog.mp3        (loop 60-120s  ambiente brumoso, viento mínimo)
  //   - storm_rain.mp3 (loop 30-60s   lluvia más intensa, dramática)
  //   - thunder.mp3    (one-shot 3-5s trueno individual, disparado random en tormenta)
  //   - night.mp3      (loop 90-120s  grillos, búhos ocasionales)
  //   - snow.mp3       (loop 60-90s   viento helado, crujidos)
  {
    id: 'sunny',
    label: 'Soleado',
    animation: null,
    sound: { src: '/sounds/sunny.mp3', mode: 'loop' },
    tint: null,
  },
  {
    id: 'rain',
    label: 'Lluvia',
    animation: 'rain',
    sound: { src: '/sounds/rain.mp3', mode: 'loop' },
    tint: 'rgba(150, 175, 200, 0.18)',
  },
  {
    id: 'fog',
    label: 'Niebla',
    animation: 'fog',
    sound: { src: '/sounds/fog.mp3', mode: 'loop' },
    tint: 'rgba(220, 220, 225, 0.28)',
  },
  {
    id: 'storm',
    label: 'Tormenta',
    animation: 'storm',
    sound: [
      { src: '/sounds/storm_rain.mp3', mode: 'loop' },
      { src: '/sounds/thunder.mp3', mode: 'random', intervalMs: [8_000, 25_000] },
    ],
    tint: 'rgba(70, 75, 90, 0.35)',
  },
  {
    id: 'night',
    label: 'Noche',
    animation: 'night',
    sound: { src: '/sounds/night.mp3', mode: 'loop' },
    tint: 'rgba(35, 45, 65, 0.40)',
  },
  {
    id: 'snow',
    label: 'Nieve',
    animation: 'snow',
    sound: { src: '/sounds/snow.mp3', mode: 'loop' },
    tint: 'rgba(240, 245, 255, 0.20)',
  },
] as const;

export function getWeather(id: string): WeatherDef {
  return WEATHERS.find((w) => w.id === id) ?? WEATHERS[0]!;
}
