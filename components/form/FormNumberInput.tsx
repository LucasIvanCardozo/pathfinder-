'use client';

import { useFormContext } from 'react-hook-form';
import styles from './control.module.css';

type FormNumberInputProps = {
  name: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Number input wired to RHF. Values are stored as numbers (RHF
 * coerces via the valueAsNumber register option).
 */
export function FormNumberInput({
  name,
  min,
  max,
  step = 1,
  disabled = false,
  placeholder,
}: FormNumberInputProps) {
  const { register } = useFormContext();
  return (
    <input
      id={name}
      type="number"
      className={styles.control}
      inputMode="numeric"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      {...register(name, { valueAsNumber: true })}
    />
  );
}
