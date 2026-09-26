"use client";

import React from "react";
import styles from "./palette-item.module.css";

import { useDraggable } from "@dnd-kit/core";

import { LayoutPreview } from "./layout-preview";
import { LayoutPreset } from "../../../../types/layout-preset";

interface PaletteItemProps {
  preset: LayoutPreset;
}

export const PaletteItem = React.memo<PaletteItemProps>(({ preset }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${preset}`,
    data: {
      type: "row",
      data: preset,
    },
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.item}
      style={style}
      {...listeners}
      {...attributes}
      disabled={isDragging}
    >
      <LayoutPreview preset={preset} />
    </button>
  );
});

PaletteItem.displayName = "PaletteItem";
