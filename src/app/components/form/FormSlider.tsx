"use client";

import { useFormContext } from "react-hook-form";
import styles from "./FormSlider.module.css";

type FormSliderProps = {
  name: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
};

/**
 * Range slider wired to react-hook-form. Same pattern as the other Form*
 * inputs: consumes the controller from FormProvider via `register`.
 */
export function FormSlider({
  name,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  ariaLabel,
}: FormSliderProps) {
  const { register } = useFormContext();
  return (
    <input
      id={name}
      type="range"
      className={styles.slider}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel ?? name}
      {...register(name, { valueAsNumber: true })}
    />
  );
}