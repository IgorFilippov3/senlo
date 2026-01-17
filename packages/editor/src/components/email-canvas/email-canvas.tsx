"use client";

import styles from "./email-canvas.module.css";

import { RowView } from "./components/row-view/row-view";
import { useEditorStore } from "../../state/editor.store";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@senlo/ui";

export const EmailCanvas = () => {
  const design = useEditorStore((s) => s.design);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const activeDragType = useEditorStore((s) => s.activeDragType);
  const isDragActive = useEditorStore((s) => s.isDragActive);
  const settings = design.settings;

  const { isOver, setNodeRef } = useDroppable({
    id: "canvas-drop-zone",
    disabled:
      !isDragActive ||
      (activeDragType !== "row" && activeDragType !== "saved-row"),
    data: {
      type: "canvas",
    },
  });

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(styles.canvas, isOver && styles.dragOver)}
      onClick={handleCanvasClick}
      style={{
        backgroundColor: settings?.backgroundColor,
        fontFamily: settings?.fontFamily,
        color: settings?.textColor,
      }}
    >
      <div className={styles.email}>
        {design.rows.length === 0 ? (
          <div className={styles.empty}>
            No content yet. Add a row to start designing your email.
          </div>
        ) : (
          design.rows.map((row) => <RowView key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
};
