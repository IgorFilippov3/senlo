"use client";

import React from "react";

import { LAYOUT_PRESETS } from "../../../../state/columns/presets";
import type { LayoutPreset } from "../../../../types/layout-preset";
import styles from "./palette-item.module.css";

/** The gap between the columns, matching `.preview` in the stylesheet. */
const PREVIEW_GAP = 4;

/**
 * A row layout drawn to scale.
 *
 * Used by the palette item the author drags and by the overlay that follows the
 * cursor while they drag it. Both used to carry their own `switch` over the
 * layouts - two of the five places the same widths were written out - and
 * neither switch had a default, so a layout added to the table but not to both
 * files rendered as nothing at all.
 */
export const LayoutPreview = React.memo<{ preset: LayoutPreset }>(
  ({ preset }) => {
    const widths = LAYOUT_PRESETS[preset];

    // Each column gives up its share of the gaps between them, so the columns
    // and the gaps together come to exactly the preview's width. The per-layout
    // arithmetic this replaces was wrong in every multi-column case: two
    // columns each gave up 1px where 2px was theirs to give, and the preview
    // overflowed its card by that much.
    const inset = (PREVIEW_GAP * (widths.length - 1)) / widths.length;

    return (
      <div className={styles.preview}>
        {widths.map((width, i) => (
          <div
            key={i}
            className={styles.previewCol}
            style={{ flex: `0 0 calc(${width}% - ${inset.toFixed(2)}px)` }}
          />
        ))}
      </div>
    );
  },
);

LayoutPreview.displayName = "LayoutPreview";
