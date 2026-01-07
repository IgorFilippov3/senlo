"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../../lib/cn";
import styles from "./slider.module.css";

export interface SliderProps {
  /** Label text above the slider */
  label?: string;
  /** Current value */
  value?: number;
  /** Minimum value (default: 0) */
  min?: number;
  /** Maximum value (default: 100) */
  max?: number;
  /** Step increment (default: 1) */
  step?: number;
  /** Unit suffix (e.g., "px", "%") */
  unit?: string;
  /** Callback when value changes */
  onChange?: (value: number) => void;
  /** Whether the slider is disabled */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * A slider component with number input and optional label.
 *
 * @example
 * ```tsx
 * <Slider
 *   label="Font Size"
 *   value={fontSize}
 *   min={12}
 *   max={72}
 *   unit="px"
 *   onChange={setFontSize}
 * />
 * ```
 */
export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      label,
      value,
      min = 0,
      max = 100,
      step = 1,
      unit,
      onChange,
      disabled,
      className,
    },
    ref
  ) => {
    // Internal state for smooth dragging
    const [localValue, setLocalValue] = useState(value ?? min);

    // Sync with external value (e.g. from store or undo/redo)
    useEffect(() => {
      if (value !== undefined) {
        setLocalValue(value);
      }
    }, [value]);

    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      setLocalValue(newValue);
      if (onChange) onChange(newValue);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value === "" ? min : parseFloat(e.target.value);
      if (!isNaN(val)) {
        setLocalValue(val);
        if (onChange) onChange(val);
      }
    };

    return (
      <div
        className={cn(
          styles.container,
          disabled && styles.disabled,
          className
        )}
      >
        <div className={styles.header}>
          {label && <span className={styles.label}>{label}</span>}
          <div className={styles.inputWrapper}>
            <input
              type="number"
              className={styles.numberInput}
              value={localValue}
              min={min}
              max={max}
              step={step}
              onChange={handleInputChange}
              disabled={disabled}
            />
            {unit && <span className={styles.unit}>{unit}</span>}
          </div>
        </div>
        <input
          ref={ref}
          type="range"
          className={styles.rangeInput}
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleRangeChange}
          disabled={disabled}
        />
      </div>
    );
  }
);

Slider.displayName = "Slider";








