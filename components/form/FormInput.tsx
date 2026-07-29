"use client";

import { useFormContext } from "react-hook-form";
import styles from "./control.module.css";

type FormInputProps = {
  name: string;
  placeholder?: string;
  type?: "text" | "email" | "url";
  disabled?: boolean;
};

/**
 * Text input wired to a form field via React Hook Form's register.
 * Must be used inside a FormProvider.
 */
export function FormInput({
  name,
  placeholder,
  type = "text",
  disabled = false,
}: FormInputProps) {
  const { register } = useFormContext();
  return (
    <input
      id={name}
      type={type}
      className={styles.control}
      placeholder={placeholder}
      disabled={disabled}
      {...register(name)}
    />
  );
}
