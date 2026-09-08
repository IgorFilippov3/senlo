"use client";

import React, { useState, useCallback } from "react";
import { cn } from "../../lib/cn";
import {
  Link,
  Link2Off,
  MoveVertical,
  MoveHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import styles from "./padding-control.module.css";

/** Padding values for all four sides */
export interface PaddingValue {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface PaddingControlProps {
  /** Current padding values */
  value?: PaddingValue;
  /**
   * Heading shown above the inputs. It says "Padding" unless told otherwise,
   * because a panel can hold two of these - the space inside a block and the
   * gap around it - and two controls under the same word are indistinguishable.
   */
  title?: string;
  /** Callback when padding changes */
  onChange: (value: PaddingValue) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * A control for editing padding values on all four sides.
 * Supports linked mode (vertical/horizontal) and individual mode.
 *
 * @example
 * ```tsx
 * <PaddingControl
 *   value={{ top: 10, right: 20, bottom: 10, left: 20 }}
 *   onChange={setPadding}
 * />
 * ```
 */
const PaddingControlComponent = ({
  value = {},
  onChange,
  className,
  title = "Padding",
}: PaddingControlProps) => {
  const [isLinked, setIsLinked] = useState(true);

  const top = value.top ?? 0;
  const right = value.right ?? 0;
  const bottom = value.bottom ?? 0;
  const left = value.left ?? 0;

  const handleUpdate = useCallback(
    (updates: PaddingValue) => {
      onChange({ ...value, ...updates });
    },
    [value, onChange]
  );

  const handleLinkedUpdate = (type: "vertical" | "horizontal", val: number) => {
    if (type === "vertical") {
      handleUpdate({ top: val, bottom: val });
    } else {
      handleUpdate({ left: val, right: val });
    }
  };

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
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
          isLinked ? styles.linkedGrid : styles.individualGrid
        )}
      >
        {isLinked ? (
          <>
            <div className={styles.field}>
              <div className={styles.inputWrapper}>
                <MoveVertical size={12} className={styles.icon} />
                <input
                  type="number"
                  className={styles.input}
                  value={top}
                  onChange={(e) =>
                    handleLinkedUpdate(
                      "vertical",
                      parseInt(e.target.value) || 0
                    )
                  }
                />
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.inputWrapper}>
                <MoveHorizontal size={12} className={styles.icon} />
                <input
                  type="number"
                  className={styles.input}
                  value={left}
                  onChange={(e) =>
                    handleLinkedUpdate(
                      "horizontal",
                      parseInt(e.target.value) || 0
                    )
                  }
                />
              </div>
            </div>
          </>
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
                    handleUpdate({ top: parseInt(e.target.value) || 0 })
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
                    handleUpdate({ right: parseInt(e.target.value) || 0 })
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
                    handleUpdate({ bottom: parseInt(e.target.value) || 0 })
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
                    handleUpdate({ left: parseInt(e.target.value) || 0 })
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

PaddingControlComponent.displayName = "PaddingControl";

export const PaddingControl = PaddingControlComponent;




