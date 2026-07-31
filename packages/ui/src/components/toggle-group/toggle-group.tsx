"use client";

import React, { ReactNode } from "react";
import { cn } from "../../lib/cn";
import styles from "./toggle-group.module.css";

/** A single option in the toggle group */
export interface ToggleGroupOption<T extends string> {
  /** The value of this option */
  value: T;
  /** Icon to display */
  icon: ReactNode;
  /** Accessible label/tooltip */
  label?: string;
}

export interface ToggleGroupProps<T extends string> {
  /** Currently selected value */
  value: T;
  /** Available options */
  options: ToggleGroupOption<T>[];
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * A group of toggle buttons for single selection.
 * Often used for alignment, layout options, etc.
 *
 * @example
 * ```tsx
 * <ToggleGroup
 *   value={alignment}
 *   onChange={setAlignment}
 *   options={[
 *     { value: "left", icon: <AlignLeft />, label: "Align Left" },
 *     { value: "center", icon: <AlignCenter />, label: "Align Center" },
 *     { value: "right", icon: <AlignRight />, label: "Align Right" },
 *   ]}
 * />
 * ```
 */
const ToggleGroupComponent = <T extends string>({
  value,
  options,
  onChange,
  className,
}: ToggleGroupProps<T>) => {
  return (
    <div className={cn(styles.toggleGroup, className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            styles.button,
            value === option.value && styles.active
          )}
          onClick={() => onChange(option.value)}
          title={option.label}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
};

ToggleGroupComponent.displayName = "ToggleGroup";

export const ToggleGroup = ToggleGroupComponent;











