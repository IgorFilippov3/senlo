"use client";

import styles from "./row-view.module.css";
import { RowBlock, evaluateCondition } from "@senlo/core";
import { ColumnView } from "../column-view/column-view";
import { RowDropZones } from "../row-drop-zones/row-drop-zones";
import { RowViewMenu } from "../row-view-menu/row-view-menu";
import { useEditorStore } from "../../../../state/editor.store";
import { cn } from "@senlo/ui";
import { GitBranch } from "lucide-react";

interface RowViewProps {
  row: RowBlock;
}

export const RowView = ({ row }: RowViewProps) => {
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const isDragActive = useEditorStore((s) => s.isDragActive);
  const activeDragType = useEditorStore((s) => s.activeDragType);
  const hoveredRowId = useEditorStore((s) => s.hoveredRowId);
  const setHoveredRowId = useEditorStore((s) => s.setHoveredRowId);
  // Get content width from global settings
  const contentWidth = useEditorStore((s) => s.design.settings?.contentWidth);
  const previewMode = useEditorStore((s) => s.previewMode);
  const previewContact = useEditorStore((s) => s.previewContact);

  // Evaluate condition in preview mode
  if (previewMode && row.condition) {
    const isVisible = evaluateCondition(row.condition, {
      responsiveStyles: [],
      options: {
        data: {
          contact: previewContact || {},
          custom: previewContact || {},
          workspace: { name: "Sample Workspace" },
          trigger: { name: "Sample Trigger" },
          unsubscribeUrl: "https://senlo.io/unsubscribe/sample-token",
        },
      },
    });

    if (!isVisible) {
      return null;
    }
  }

  const isSelected = selection?.kind === "row" && selection.id === row.id;
  const isHovered = isDragActive && hoveredRowId === row.id;

  const { backgroundColor, padding, borderRadius } = row.settings;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    select({ kind: "row", id: row.id });
  };

  const containerStyle: React.CSSProperties = {
    position: "relative",
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: contentWidth ? `${contentWidth}px` : "600px",
    margin: "0 auto",
    width: "100%",
    backgroundColor: backgroundColor || "transparent",
    borderTopLeftRadius:
      borderRadius?.top !== undefined ? `${borderRadius.top}px` : "0px",
    borderTopRightRadius:
      borderRadius?.top !== undefined ? `${borderRadius.top}px` : "0px",
    borderBottomLeftRadius:
      borderRadius?.bottom !== undefined ? `${borderRadius.bottom}px` : "0px",
    borderBottomRightRadius:
      borderRadius?.bottom !== undefined ? `${borderRadius.bottom}px` : "0px",
    paddingTop: padding?.top || 0,
    paddingRight: padding?.right || 16,
    paddingBottom: padding?.bottom || 0,
    paddingLeft: padding?.left || 16,
  };

  return (
    <div
      className={cn(styles.rowContainer, isSelected && styles.selected)}
      onClick={handleClick}
      onMouseEnter={() => {
        if (isDragActive) {
          setHoveredRowId(row.id);
        }
      }}
      onMouseLeave={() => {
        if (isDragActive) {
          setHoveredRowId(null);
        }
      }}
      style={containerStyle}
    >
      {isSelected && !isDragActive && <RowViewMenu rowId={row.id} />}
      {row.condition && (
        <div
          className="absolute top-2 right-4 z-10 bg-blue-600 text-white p-1 rounded-full shadow-md"
          title={`Row Condition: ${row.condition.variable} ${row.condition.operator} ${row.condition.value ?? ""}`}
        >
          <GitBranch size={12} />
        </div>
      )}
      <div className={styles.row} style={contentStyle}>
        <div className={styles.inner}>
          {row.columns.map((column) => (
            <ColumnView key={column.id} column={column} rowId={row.id} />
          ))}
        </div>
      </div>

      {isDragActive &&
        (activeDragType === "row" || activeDragType === "saved-row") && (
          <RowDropZones rowId={row.id} />
        )}
    </div>
  );
};
