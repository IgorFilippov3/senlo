"use client";

import React from "react";
import { SavedRow, RowBlock } from "@senlo/core";
import { useDraggable } from "@dnd-kit/core";
import { Trash2 } from "lucide-react";
import { RowThumbnail } from "./row-thumbnail";
import styles from "./rows-section.module.css";

interface SavedRowCardProps {
  row: SavedRow;
  onDelete: (id: number) => void;
  onClick: () => void;
}

export const SavedRowCard = ({ row, onDelete, onClick }: SavedRowCardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `saved-row-${row.id}`,
    data: {
      type: "saved-row",
      data: row,
    },
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={styles.savedRowCard}
      style={style}
      onClick={onClick}
      {...listeners}
      {...attributes}
    >
      <RowThumbnail row={row.data as RowBlock} />
      <button
        className={styles.deleteButton}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(row.id);
        }}
        title="Delete saved row"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};
