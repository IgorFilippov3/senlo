"use client";

import { memo } from "react";
import styles from "./column-view.module.css";
import { columnCard, type ColumnId, type RowId } from "@senlo/core";
import { PackagePlus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useShallow } from "zustand/react/shallow";
import { BlockView } from "../block-view/block-view";
import { DropIndicator } from "../drop-indicator/drop-indicator";
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
          // Immer keeps the reference while the settings are untouched, so
          // the shallow compare still skips renders caused by typing in a block.
          settings: found.settings,
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
    const { outer, card } = columnCard(column.settings);
    const hasCard = Object.keys(card).length > 0;

    // The column itself is the target only where no block's zone is - the
    // space under its last block, its padding, its margin - and a drop there
    // appends. The column's own highlight cannot say so once a card paints over
    // it, so the line goes where the block will land: after the last one.
    const appendIndicator =
      isOver && !isEmpty ? (
        <div className={styles.appendIndicator}>
          <DropIndicator isVisible />
        </div>
      ) : null;

    const content = isEmpty ? (
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
    );

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
          ...outer,
        }}
        onClick={handleClick}
      >
        {/*
          The card hugs its content rather than stretching to the row's
          height: in the message a column is an inline-block, so a card next
          to a taller one ends where its own blocks end, and the canvas must
          not promise equal heights the email will not keep.
        */}
        {hasCard ? (
          <div className={styles.card} style={card}>
            {content}
            {appendIndicator}
          </div>
        ) : (
          <>
            {content}
            {appendIndicator}
          </>
        )}
      </div>
    );
  },
);

ColumnView.displayName = "ColumnView";
