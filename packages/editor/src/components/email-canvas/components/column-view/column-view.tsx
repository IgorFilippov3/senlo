"use client";

import styles from "./column-view.module.css";
import { ColumnBlock } from "@senlo/core";
import { PackagePlus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { BlockView } from "../block-view/block-view";
import { useEditorStore } from "../../../../state/editor.store";
import { cn } from "@senlo/ui";

interface ColumnViewProps {
  column: ColumnBlock;
  rowId: string;
  localData?: Record<string, any>;
}

export const ColumnView = ({ column, rowId, localData }: ColumnViewProps) => {
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const isDragActive = useEditorStore((s) => s.isDragActive);
  const activeDragType = useEditorStore((s) => s.activeDragType);

  const isEmpty = column.blocks.length === 0;
  const isSelected =
    !isEmpty && selection?.kind === "column" && selection.id === column.id;

  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    disabled:
      !isDragActive ||
      (activeDragType !== "block" && activeDragType !== "content"),
    data: {
      type: "column",
      columnId: column.id,
    },
  });

  // Drop zone for end of column (when blocks exist)
  const { isOver: isOverEnd, setNodeRef: setEndRef } = useDroppable({
    id: `column-end-${column.id}`,
    disabled:
      !isDragActive ||
      (activeDragType !== "block" && activeDragType !== "content"),
    data: {
      type: "block-drop-zone",
      columnId: column.id,
      position: column.blocks.length,
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEmpty) {
      select({ kind: "column", id: column.id });
    }
  };

  const style: React.CSSProperties = {
    flexBasis: `${column.width}%`,
    maxWidth: `${column.width}%`,
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        styles.column,
        isEmpty && styles.empty,
        isSelected && styles.selected,
        isOver && styles.dragOver,
      )}
      style={style}
      onClick={handleClick}
    >
      {isEmpty ? (
        <div className={styles.emptyPlaceholder}>
          <PackagePlus className={styles.placeholderIcon} size={20} />
          <span className={styles.placeholderText}>Drop content here</span>
        </div>
      ) : (
        <>
          {column.blocks.map((block) => (
            <BlockView
              key={block.id}
              block={block}
              columnId={column.id}
              rowId={rowId}
              localData={localData}
            />
          ))}
          {/* {isDragActive && (activeDragType === "block" || activeDragType === "content") && (
            <div 
              ref={setEndRef} 
              style={{ 
                height: "20px", 
                width: "100%", 
                position: "relative" 
              }}
            >
              {isOverEnd && (
                <div style={{ 
                  position: "absolute", 
                  bottom: 0, 
                  left: 8, 
                  right: 8, 
                  height: 2 
                }}>
                  <DropIndicator isVisible={true} />
                </div>
              )}
            </div>
          )} */}
        </>
      )}
    </div>
  );
};
