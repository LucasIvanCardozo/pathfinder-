'use client';

import { FogEffect } from './FogEffect';
import { RainEffect } from './RainEffect';
import { getWeather } from './registry';
import { SnowEffect } from './SnowEffect';
import { StormEffect } from './StormEffect';
import styles from './weather-overlay.module.css';

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

  // Branched animations: render with an explicit subtree because they need
  // extra layers (storm listens for thunder; night stacks vignette + tinted
  // moonlight). These never go through `ANIMATIONS`.
  const isStorm = def.animation === 'storm';
  const isNight = def.animation === 'night';
  const Animation = !isStorm && !isNight && hasAnimation ? ANIMATIONS[def.animation!] : null;

  return (
    <>
      {isStorm ? (
        <StormEffect thunderAt={thunderAt} />
      ) : isNight ? (
        <div className={styles.nightVignette} aria-hidden="true" />
      ) : Animation ? (
        <Animation />
      ) : null}
      {hasTint ? (
        <>
          {/* Night also gets a faint warm moonlight glow on top of the
              base tint — it's the only weather that uses an extra CSS
              layer beyond the standard tint overlay. */}
          {isNight ? <div className={styles.moonlight} aria-hidden="true" /> : null}
          <div
            className={styles.tintOverlay}
            style={{ background: def.tint ?? undefined }}
            aria-hidden="true"
          />
        </>
      ) : null}
    </>
  );
}
