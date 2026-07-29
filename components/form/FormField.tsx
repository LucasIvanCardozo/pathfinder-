'use client';

import type { ReactNode } from 'react';
import styles from './form-field.module.css';

type FormFieldProps = {
  /** Field label shown above the input. */
  label: string;
  /** Optional hint text shown below the input. */
  hint?: string;
  /** Error message (from RHF). When present, overrides hint. */
  error?: string;
  /** Marks the field as required (visual indicator only). */
  required?: boolean;
  /** Optional id for the control. Defaults to a generated value. */
  htmlFor?: string;
  children: ReactNode;
};

/**
 * Visual wrapper for any form control. Centralizes label + error + hint
 * rendering so individual inputs don't need to repeat that boilerplate.
 */
export function FormField({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  children,
}: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required ? <span className={styles.required}> *</span> : null}
      </label>
      {children}
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
