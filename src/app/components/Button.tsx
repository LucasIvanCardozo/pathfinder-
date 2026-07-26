import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "danger" | "default";
type Size = "mini" | "normal";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
};

/**
 * Standard button primitive used across the app. Variant and size cover every
 * shape previously hand-rolled as `className="button ..."` in TSX; no className
 * is exposed so callers cannot escape the design vocabulary.
 */
export function Button({
  variant = "default",
  size = "normal",
  children,
  ...rest
}: ButtonProps) {
  const classes = [styles.button];
  if (variant !== "default") classes.push(styles[variant]);
  if (size === "mini") classes.push(styles.mini);
  return (
    <button {...rest} className={classes.join(" ")}>
      {children}
    </button>
  );
}