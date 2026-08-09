'use client';

import { useEffect, useRef } from 'react';

/**
 * Plays a single ambient music track on loop. Mounts nothing when
 * `src === null` (silence).
 *
 * Same engine shape as `useWeatherAudio` but trimmed for the music case:
 * no `random` mode, no thunder-trigger callback. Music is a single track
 * with loop + volume — that's it.
 *
 * The `src` map keeps one `HTMLAudioElement` per source across re-renders
 * and across track changes. Switching from track A to track B only
 * adds B and removes A — if you switch back to A, the SAME `<audio>`
 * element is reused (no replay from t=0 unless the track just mounted).
 * `volume` changes only update the live audio instances, never recreate
 * them.
 *
 * Browser autoplay rules apply: the first `play()` may be rejected until
 * the user interacts with the page. Those rejections are silent — a
 * later user gesture unlocks them.
 */
export function useAmbientAudio(src: string | null, volume: number): void {
  // Mirror `volume` into a ref so the audio-creation effect below reads
  // the current volume synchronously when it first calls `a.play()`.
  // Without this, the audio plays at the HTMLAudioElement's default
  // volume (1.0) until the dedicated volume-sync effect runs.
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Mount/refresh the audio element when the src changes.
  useEffect(() => {
    // Silence: tear down any existing audio.
    if (src === null) {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
        a.load();
      }
      audioRef.current = null;
      return;
    }

    // Reuse the element if the src hasn't actually changed.
    const existing = audioRef.current;
    if (existing?.src.endsWith(src)) {
      return;
    }

    // Tear down previous (different src) before mounting the new one.
    if (existing) {
      existing.pause();
      existing.removeAttribute('src');
      existing.load();
    }

    const a = new Audio(src);
    a.loop = true;
    a.preload = 'auto';
    a.volume = Math.max(0, Math.min(1, volumeRef.current));
    audioRef.current = a;
    a.play().catch(() => {});

    // Teardown on src change or unmount.
    return () => {
      a.pause();
      a.removeAttribute('src');
      a.load();
      if (audioRef.current === a) audioRef.current = null;
    };
  }, [src]);

  // Sync volume across the live audio on every change.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  // Final teardown when the consumer unmounts.
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (!a) return;
      a.pause();
      a.removeAttribute('src');
      a.load();
      audioRef.current = null;
    };
  }, []);
}
