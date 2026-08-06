'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './Compass.module.css';

/** Quarter-turn steps the user can cycle through. The compass image has the N
 *  pointing up by default, so `0°` is the as-drawn orientation. */
const STEPS = [0, 90, 180, 270] as const;

/** Human-readable cardinal that ends up at the top of the rose after each step.
 *  Mirrors `STEPS` so `CARDINALS[step]` reads naturally in the aria-label. */
const TOP_CARDINAL = ['norte', 'este', 'sur', 'oeste'] as const;

/**
 * Floating compass rose anchored to the bottom-right of the editor viewport.
 *
 * State is local and ephemeral: the GM rotates it mentally per map and the
 * value resets on reload. A toggle keyboard shortcut (registered in
 * `lib/shared/constants/shortcuts.ts` as `toggleCompass`) hides the widget
 * independently of the global chrome (`toggleChrome` / `H`).
 */
export function Compass() {
  const [step, setStep] = useState(0);
  const rotation = STEPS[step];
  const cardinal = TOP_CARDINAL[step];

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setStep((s) => (s + 1) % STEPS.length)}
        aria-label={`Brújula: norte hacia el ${cardinal}. Click para rotar 90°`}
        title="Click para rotar 90°"
      >
        <Image
          src="/ui/brujula.webp"
          alt=""
          width={300}
          height={300}
          className={styles.image}
          style={{ transform: `rotate(${rotation}deg)` }}
          draggable={false}
        />
      </button>
    </div>
  );
}
