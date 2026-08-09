'use client';

import { useState } from 'react';
import {
  AMBIENT_DEFAULT,
  type AmbientState,
  getMusic,
  getWeather,
  useAmbientAudio,
  useWeatherAudio,
  type WeatherDef,
} from '@/canvas';

/**
 * Holds the editor's ambient state (weather + music) and wires the two
 * audio engines. The two halves are independent: each has its own
 * volume slider, and music does not follow weather changes.
 *
 * Weather keeps its `thunderAt` timestamp so the canvas flash can sync
 * with thunder one-shots.
 */
export function useAmbientSession() {
  const [ambientState, setAmbientState] = useState<AmbientState>(AMBIENT_DEFAULT);
  const [thunderAt, setThunderAt] = useState<number | null>(null);

  const weatherDef: WeatherDef = getWeather(ambientState.weatherId);
  useWeatherAudio(weatherDef.sound, ambientState.weatherVolume / 100, (src) => {
    if (src.endsWith('thunder.mp3')) setThunderAt(Date.now());
  });

  const musicDef = getMusic(ambientState.musicId);
  useAmbientAudio(musicDef.src, ambientState.musicVolume / 100);

  return { ambientState, setAmbientState, thunderAt };
}
