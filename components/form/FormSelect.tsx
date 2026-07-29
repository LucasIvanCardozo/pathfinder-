"use client";

import { useFormContext } from "react-hook-form";
import styles from "./control.module.css";

type Option = {
  value: string;
  label: string;
};

type FormSelectProps = {
  name: string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Select wired to RHF. Uses the native <select> for native keyboard
 * navigation and accessibility.
 */
export function FormSelect({ name, options, placeholder, disabled = false }: FormSelectProps) {
  const { register } = useFormContext();
  return (
    <select
      id={name}
      className={styles.control}
      disabled={disabled}
      defaultValue=""
      {...register(name)}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
