"use client";

import React from "react";
import styles from "./content-item.module.css";

import { useDraggable } from "@dnd-kit/core";
import { ContentBlockType } from "@senlo/core";
import { getEditorBlockDefinition } from "../../../../blocks/registry";

interface ContentItemProps {
  blockType: ContentBlockType;
  label: string;
}

export const ContentItem = React.memo<ContentItemProps>(({ blockType, label }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${blockType}`,
    data: {
      type: "content",
      data: blockType,
      label: label,
    },
  });

  const Icon = getEditorBlockDefinition(blockType)?.icon;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.contentCard}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      {...listeners}
      {...attributes}
      disabled={isDragging}
    >
      <div className={styles.iconContainer}>{Icon ? <Icon size={24} /> : null}</div>
      <div className={styles.contentLabel}>{label}</div>
    </button>
  );
});

ContentItem.displayName = "ContentItem";
