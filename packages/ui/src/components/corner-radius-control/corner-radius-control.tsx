"use client";

import React, { useCallback, useState } from "react";
import { cn } from "../../lib/cn";
import {
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  Link,
  Link2Off,
} from "lucide-react";
import { Slider } from "../slider/slider";
import styles from "./corner-radius-control.module.css";

/**
 * A corner radius, with the fields named in the order CSS writes them.
 *
 * The inputs below are laid out in reading order instead - top-left and
 * top-right above bottom-left and bottom-right - which is the one place the two
 * orders differ and the only place the difference is deliberate.
 */
export interface CornerRadiusValue {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

export interface CornerRadiusControlProps {
  /** Current radius for each corner. */
  value?: CornerRadiusValue;
  /**
   * Heading shown above the inputs. A panel can hold more than one radius - a
   * block's own corners and the corners of the card behind it - and two
   * controls under the same word are indistinguishable.
   */
  title?: string;
  /** Largest radius the sliders and inputs will accept. */
  max?: number;
  onChange: (value: CornerRadiusValue) => void;
  className?: string;
}

const CORNERS = [
  { key: "topLeft", icon: CornerUpLeft, label: "Top left" },
  { key: "topRight", icon: CornerUpRight, label: "Top right" },
  { key: "bottomLeft", icon: CornerDownLeft, label: "Bottom left" },
  { key: "bottomRight", icon: CornerDownRight, label: "Bottom right" },
] as const;

/**
 * Four corners, linked into one by default.
 *
 * Linked is the common case and it is what the control opens on unless the
 * stored corners already disagree, so the usual edit is one slider and the
 * four inputs stay out of the way until someone asks for them.
 */
const CornerRadiusControlComponent = ({
  value = {},
  title = "Corner radius",
  max = 100,
  onChange,
  className,
}: CornerRadiusControlProps) => {
  const topLeft = value.topLeft ?? 0;
  const topRight = value.topRight ?? 0;
  const bottomRight = value.bottomRight ?? 0;
  const bottomLeft = value.bottomLeft ?? 0;

  // A document whose corners already differ has to open unlinked, or the panel
  // would show one number for four values and overwrite three of them on the
  // first drag.
  const [isLinked, setIsLinked] = useState(
    () =>
      topLeft === topRight &&
      topRight === bottomRight &&
      bottomRight === bottomLeft,
  );

  const handleCorner = useCallback(
    (key: keyof CornerRadiusValue, next: number) => {
      const clamped = Math.min(Math.max(Math.round(next) || 0, 0), max);
      onChange({ ...value, [key]: clamped });
    },
    [value, onChange, max],
  );

  const handleAll = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(Math.round(next) || 0, 0), max);
      onChange({
        topLeft: clamped,
        topRight: clamped,
        bottomRight: clamped,
        bottomLeft: clamped,
      });
    },
    [onChange, max],
  );

  /**
   * Linking four corners that disagree has to pick one of them, and the
   * top-left is the one the reader's eye lands on first.
   */
  const handleToggleLink = () => {
    const next = !isLinked;
    setIsLinked(next);
    if (next) handleAll(topLeft);
  };

  const values: Record<string, number> = {
    topLeft,
    topRight,
    bottomRight,
    bottomLeft,
  };

  return (
    <div className={cn(styles.container, className)}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <button
          type="button"
          className={cn(styles.toggleBtn, isLinked && styles.toggleBtnActive)}
          onClick={handleToggleLink}
          title={isLinked ? "Set each corner" : "Link all corners"}
        >
          {isLinked ? <Link size={14} /> : <Link2Off size={14} />}
        </button>
      </div>

      {isLinked ? (
        <Slider
          label="All corners"
          unit="px"
          min={0}
          max={max}
          value={topLeft}
          onChange={handleAll}
        />
      ) : (
        <div className={styles.grid}>
          {CORNERS.map(({ key, icon: Icon, label }) => (
            <div className={styles.field} key={key}>
              <div className={styles.inputWrapper}>
                <Icon size={12} className={styles.icon} />
                <input
                  type="number"
                  min={0}
                  max={max}
                  aria-label={label}
                  title={label}
                  className={styles.input}
                  value={values[key]}
                  onChange={(e) =>
                    handleCorner(
                      key as keyof CornerRadiusValue,
                      parseInt(e.target.value, 10) || 0,
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

CornerRadiusControlComponent.displayName = "CornerRadiusControl";

export const CornerRadiusControl = CornerRadiusControlComponent;
