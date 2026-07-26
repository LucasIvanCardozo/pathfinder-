"use client";

import { FogEffect } from "./FogEffect";
import { RainEffect } from "./RainEffect";
import { SnowEffect } from "./SnowEffect";
import { StormEffect } from "./StormEffect";
import { getWeather } from "./registry";

/**
 * Maps animation kinds to their prop-less canvas overlay components. Adding
 * a new effect is: (1) create the component, (2) add an entry here.
 */
const ANIMATIONS: Record<string, React.ComponentType<Record<string, never>>> = {
  rain: RainEffect as React.ComponentType<Record<string, never>>,
  fog: FogEffect as React.ComponentType<Record<string, never>>,
  snow: SnowEffect as React.ComponentType<Record<string, never>>,
};

export function WeatherOverlay({
  weatherId,
  /** Timestamp of the most recent thunder trigger; forwarded to StormEffect. */
  thunderAt,
}: {
  weatherId: string;
  thunderAt: number | null;
}) {
  const def = getWeather(weatherId);
  const hasAnimation = def.animation !== null;
  const hasTint = def.tint !== null;
  if (!hasAnimation && !hasTint) return null;

  // Storm has props (`thunderAt`) and lives outside the prop-less
  // `ANIMATIONS` map, so we branch on it BEFORE looking up `Animation` —
  // otherwise the lookup returns `undefined` and the renderer bails.
  const isStorm = def.animation === "storm";
  const Animation = !isStorm && hasAnimation ? ANIMATIONS[def.animation!] : null;

  return (
    <>
      {isStorm ? (
        <StormEffect thunderAt={thunderAt} />
      ) : Animation ? (
        <Animation />
      ) : null}
      {hasTint ? (
        <div
          className="weather-tint-overlay"
          style={{ background: def.tint ?? undefined }}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
