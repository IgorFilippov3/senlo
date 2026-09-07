"use client";

import { memo } from "react";
import styles from "./column-view.module.css";
import type { ColumnId, RowId } from "@senlo/core";
import { PackagePlus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useShallow } from "zustand/react/shallow";
import { BlockView } from "../block-view/block-view";
import { useEditorStore } from "../../../../state/editor.store";
import { cn } from "@senlo/ui";

interface ColumnViewProps {
  columnId: ColumnId;
  rowId: RowId;
  localData?: Record<string, any>;
}

/**
 * Subscribes to its width and the ids of its blocks. Editing a block changes
 * neither, so the column does not re-render while its content is being typed.
 */
export const ColumnView = memo(
  ({ columnId, rowId, localData }: ColumnViewProps) => {
    const column = useEditorStore(
      useShallow((s) => {
        const row = s.design.rows.find((r) => r.id === rowId);
        const found = row?.columns.find((c) => c.id === columnId);
        if (!found) return null;

        return {
          width: found.width,
          blockIds: found.blocks.map((b) => b.id).join(" "),
        };
      }),
    );

    const select = useEditorStore((s) => s.select);
    const isDragActive = useEditorStore((s) => s.isDragActive);
    const activeDragType = useEditorStore((s) => s.activeDragType);
    const isSelected = useEditorStore(
      (s) => s.selection?.kind === "column" && s.selection.id === columnId,
    );

    const { isOver, setNodeRef } = useDroppable({
      id: columnId,
      disabled:
        !isDragActive ||
        (activeDragType !== "block" && activeDragType !== "content"),
      data: {
        type: "column",
        columnId,
      },
    });

    if (!column) return null;

    const blockIds = column.blockIds ? column.blockIds.split(" ") : [];
    const isEmpty = blockIds.length === 0;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isEmpty) {
        select({ kind: "column", id: columnId, rowId });
      }
    };

    return (
      <div
        ref={setNodeRef}
        className={cn(
          styles.column,
          isEmpty && styles.empty,
          !isEmpty && isSelected && styles.selected,
          isOver && styles.dragOver,
        )}
        style={{
          flexBasis: `${column.width}%`,
          maxWidth: `${column.width}%`,
        }}
        onClick={handleClick}
      >
        {isEmpty ? (
          <div className={styles.emptyPlaceholder}>
            <PackagePlus className={styles.placeholderIcon} size={20} />
            <span className={styles.placeholderText}>Drop content here</span>
          </div>
        ) : (
          blockIds.map((blockId, index) => (
            <BlockView
              key={blockId}
              blockId={blockId}
              columnId={columnId}
              rowId={rowId}
              index={index}
              localData={localData}
            />
          ))
        )}
      </div>
    );
  },
);

ColumnView.displayName = "ColumnView";
