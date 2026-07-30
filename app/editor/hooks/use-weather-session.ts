import { useState } from 'react';
import { getWeather, useWeatherAudio, WEATHER_DEFAULT, type WeatherState } from '@/canvas';

export function useWeatherSession() {
  const [weatherState, setWeatherState] = useState<WeatherState>(WEATHER_DEFAULT);
  const [thunderAt, setThunderAt] = useState<number | null>(null);
  const weatherDef = getWeather(weatherState.weatherId);

  useWeatherAudio(weatherDef.sound, weatherState.volume / 100, (src) => {
    if (src.endsWith('thunder.mp3')) setThunderAt(Date.now());
  });

  return { weatherState, setWeatherState, thunderAt };
}
