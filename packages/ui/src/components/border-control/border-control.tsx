"use client";

import React, { useState, useCallback } from "react";
import { cn } from "../../lib/cn";
import {
  Link,
  Link2Off,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize,
} from "lucide-react";
import styles from "./border-control.module.css";

export interface BorderValue {
  width?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface BorderControlProps {
  value?: BorderValue;
  onChange: (value: BorderValue) => void;
  className?: string;
}

export const BorderControl = ({
  value = {},
  onChange,
  className,
}: BorderControlProps) => {
  const [isLinked, setIsLinked] = useState(() => {
    // If we have individual values but no main width, start unlinked
    return (
      value.width !== undefined ||
      (!value.top && !value.right && !value.bottom && !value.left)
    );
  });

  const width = value.width ?? 0;
  const top = value.top ?? width;
  const right = value.right ?? width;
  const bottom = value.bottom ?? width;
  const left = value.left ?? width;

  const handleUpdate = useCallback(
    (updates: BorderValue) => {
      onChange({ ...value, ...updates });
    },
    [value, onChange],
  );

  const handleLinkedUpdate = (val: number) => {
    onChange({
      ...value,
      width: val,
      top: undefined,
      right: undefined,
      bottom: undefined,
      left: undefined,
    });
  };

  const handleIndividualUpdate = (side: keyof BorderValue, val: number) => {
    const newVal = { ...value, width: undefined, [side]: val };
    // Preserve other sides if they were implicitly coming from 'width'
    if (newVal.top === undefined) newVal.top = width;
    if (newVal.right === undefined) newVal.right = width;
    if (newVal.bottom === undefined) newVal.bottom = width;
    if (newVal.left === undefined) newVal.left = width;
    onChange(newVal);
  };

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.title}>Borders (px)</span>
        <button
          type="button"
          className={cn(styles.toggleBtn, isLinked && styles.toggleBtnActive)}
          onClick={() => setIsLinked(!isLinked)}
          title={isLinked ? "Unlink sides" : "Link sides"}
        >
          {isLinked ? <Link size={14} /> : <Link2Off size={14} />}
        </button>
      </div>

      <div
        className={cn(
          styles.grid,
          isLinked ? styles.linkedGrid : styles.individualGrid,
        )}
      >
        {isLinked ? (
          <div className={styles.field}>
            <div className={styles.inputWrapper}>
              <Maximize size={12} className={styles.icon} />
              <input
                type="number"
                className={styles.input}
                value={width}
                onChange={(e) =>
                  handleLinkedUpdate(parseInt(e.target.value) || 0)
                }
                placeholder="All sides"
              />
            </div>
          </div>
        ) : (
          <>
            <div className={styles.field}>
              <div className={styles.inputWrapper}>
                <ArrowUp size={12} className={styles.icon} />
                <input
                  type="number"
                  className={styles.input}
                  value={top}
                  onChange={(e) =>
                    handleIndividualUpdate("top", parseInt(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.inputWrapper}>
                <ArrowRight size={12} className={styles.icon} />
                <input
                  type="number"
                  className={styles.input}
                  value={right}
                  onChange={(e) =>
                    handleIndividualUpdate(
                      "right",
                      parseInt(e.target.value) || 0,
                    )
                  }
                />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.inputWrapper}>
                <ArrowDown size={12} className={styles.icon} />
                <input
                  type="number"
                  className={styles.input}
                  value={bottom}
                  onChange={(e) =>
                    handleIndividualUpdate(
                      "bottom",
                      parseInt(e.target.value) || 0,
                    )
                  }
                />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.inputWrapper}>
                <ArrowLeft size={12} className={styles.icon} />
                <input
                  type="number"
                  className={styles.input}
                  value={left}
                  onChange={(e) =>
                    handleIndividualUpdate(
                      "left",
                      parseInt(e.target.value) || 0,
                    )
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
