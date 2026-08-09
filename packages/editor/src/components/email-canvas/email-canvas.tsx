"use client";

import styles from "./email-canvas.module.css";

import { RowView } from "./components/row-view/row-view";
import { useEditorStore } from "../../state/editor.store";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@senlo/ui";
import { resolveVariable } from "@senlo/core";

export const EmailCanvas = () => {
  const design = useEditorStore((s) => s.design);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const activeDragType = useEditorStore((s) => s.activeDragType);
  const isDragActive = useEditorStore((s) => s.isDragActive);
  const previewMode = useEditorStore((s) => s.previewMode);
  const previewContact = useEditorStore((s) => s.previewContact);
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

  const renderRows = () => {
    if (design.rows.length === 0) {
      return (
        <div className={styles.empty}>
          No content yet. Add a row to start designing your email.
        </div>
      );
    }

    return design.rows.flatMap((row) => {
      if (previewMode && row.loop) {
        const data = {
          contact: previewContact || {},
          custom: previewContact || {},
          workspace: { name: "Sample Workspace" },
          trigger: { name: "Sample Trigger" },
          unsubscribeUrl: "https://senlo.io/unsubscribe/sample-token",
        };
        const loopData = resolveVariable(row.loop.variable, data);

        if (Array.isArray(loopData)) {
          return loopData.map((item, index) => (
            <RowView
              key={`${row.id}-${index}`}
              row={row}
              localData={{ [row.loop!.alias]: item }}
              isLoopItem={true}
            />
          ));
        }
      }

      return <RowView key={row.id} row={row} />;
    });
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
      <div className={styles.email}>{renderRows()}</div>
    </div>
  );
};
