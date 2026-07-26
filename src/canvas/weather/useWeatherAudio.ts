"use client";

import { useEffect, useMemo, useRef } from "react";
import type { WeatherSound } from "./registry";

/**
 * Plays one or more audio tracks associated with the active weather.
 *
 * The hook keeps a single `HTMLAudioElement` per `src` across re-renders
 * (and across weather changes) via a ref-backed map. This means:
 *   - Switching weather from `rain` → `storm` doesn't restart the rain
 *     loop; only `thunder` is added.
 *   - `volume` changes only affect the live audio instances, never
 *     recreate them.
 *
 * `mode: "loop"` plays the file continuously; `mode: "random"` plays it
 * once, then schedules the next play after a random delay in
 * `intervalMs`. The same `<audio>` is reused for both modes (kept paused
 * for loop, reset/replayed for random).
 *
 * Browser autoplay rules apply: the first `play()` may be rejected until
 * the user interacts with the page. Those rejections are silent — a later
 * user gesture unlocks them.
 */
export function useWeatherAudio(
  sound: WeatherSound | WeatherSound[] | null,
  volume: number,
  /** Called each time a `random`-mode audio is triggered. Useful for
   *  syncing visuals (e.g. lightning flashes) with audio cues. */
  onTrigger?: (src: string) => void,
): void {
  const list = useMemo<readonly WeatherSound[]>(
    () => (sound === null ? [] : Array.isArray(sound) ? sound : [sound]),
    [sound],
  );

  // Keep the latest callback in a ref so the long-lived setTimeouts created
  // by the setup effect always invoke the freshest closure without forcing
  // it to be a stable reference.
  const onTriggerRef = useRef(onTrigger);
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  // Mirror `volume` into a ref so the audio-creation effect below can read
  // the current volume synchronously when it first calls `a.play()`.
  // Without this, the audio plays at the HTMLAudioElement's default volume
  // (1.0) until the dedicated volume-sync effect runs, causing a brief
  // burst at max before dropping to the slider's value.
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const triggersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sync the live audio set with the spec list. Re-runs only when the
  // list identity changes (i.e. when the user picks a different weather).
  useEffect(() => {
    const wantedSrcs = new Set(list.map((s) => s.src));

    // Tear down audios that are no longer wanted.
    for (const [src, a] of audiosRef.current) {
      if (!wantedSrcs.has(src)) {
        a.pause();
        a.removeAttribute("src");
        a.load();
        audiosRef.current.delete(src);
        const t = triggersRef.current.get(src);
        if (t) {
          clearTimeout(t);
          triggersRef.current.delete(src);
        }
      }
    }

    for (const s of list) {
      let a = audiosRef.current.get(s.src);
      if (!a) {
        a = new Audio(s.src);
        a.loop = s.mode === "loop";
        a.preload = "auto";
        audiosRef.current.set(s.src, a);
      }
      // Sync volume BEFORE play(): the dedicated volume-sync effect runs
      // after this one, so without this set the audio would briefly play
      // at the HTMLAudioElement's default volume (1.0) before being
      // dropped to the slider's value.
      a.volume = Math.max(0, Math.min(1, volumeRef.current));

      if (s.mode === "loop") {
        // Best-effort start. Any rejection (autoplay block) is silently
        // ignored; a later interaction will unlock playback.
        a.play().catch(() => {});
        const t = triggersRef.current.get(s.src);
        if (t) {
          clearTimeout(t);
          triggersRef.current.delete(s.src);
        }
      } else {
        // Random mode: schedule a one-shot play, then reschedule for the
        // next random interval. The timer lives in triggersRef keyed by
        // src, so it's safe against multiple weather changes.
        const cancelExisting = triggersRef.current.get(s.src);
        if (cancelExisting) clearTimeout(cancelExisting);

        const scheduleNext = () => {
          const [min, max] = s.intervalMs ?? [8_000, 25_000];
          const wait = Math.floor(min + Math.random() * (max - min));
          const id = setTimeout(() => {
            const live = audiosRef.current.get(s.src);
            if (!live) return; // wiped on weather change
            // Trigger the visual first so the flash leads the audio. In
            // real life the lightning hits the eye before the thunder
            // reaches it, and `audio.play()` also has a small load delay
            // — this ordering hides both naturally.
            onTriggerRef.current?.(s.src);
            live.currentTime = 0;
            live.play().catch(() => {});
            scheduleNext();
          }, wait);
          triggersRef.current.set(s.src, id);
        };
        scheduleNext();
      }
    }
    // Intentional: no cleanup here. Teardown happens above when entries
    // are removed from the list, and on unmount (below).
  }, [list]);

  // Sync volume across all live audio instances on every change.
  useEffect(() => {
    const v = Math.max(0, Math.min(1, volume));
    for (const a of audiosRef.current.values()) {
      a.volume = v;
    }
  }, [volume]);

  // Final teardown when the consumer unmounts.
  useEffect(() => {
    return () => {
      for (const t of triggersRef.current.values()) clearTimeout(t);
      triggersRef.current.clear();
      for (const a of audiosRef.current.values()) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
      audiosRef.current.clear();
    };
  }, []);
}
