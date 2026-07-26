import type { ReactNode } from "react";
import styles from "./Empty.module.css";

type EmptyProps = {
  children: ReactNode;
};

/**
 * Centered, dashed-border empty-state block used by lists that have no data.
 * Each consumer passes its own Spanish copy as children.
 */
export function Empty({ children }: EmptyProps) {
  return <p className={styles.empty}>{children}</p>;
}