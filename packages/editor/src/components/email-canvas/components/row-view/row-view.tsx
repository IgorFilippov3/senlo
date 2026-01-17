"use client";

import styles from "./row-view.module.css";
import { RowBlock } from "@senlo/core";
import { ColumnView } from "../column-view/column-view";
import { RowDropZones } from "../row-drop-zones/row-drop-zones";
import { RowViewMenu } from "../row-view-menu/row-view-menu";
import { useEditorStore } from "../../../../state/editor.store";
import { cn } from "@senlo/ui";

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
    borderTopLeftRadius: borderRadius?.top !== undefined ? `${borderRadius.top}px` : "0px",
    borderTopRightRadius: borderRadius?.top !== undefined ? `${borderRadius.top}px` : "0px",
    borderBottomLeftRadius: borderRadius?.bottom !== undefined ? `${borderRadius.bottom}px` : "0px",
    borderBottomRightRadius: borderRadius?.bottom !== undefined ? `${borderRadius.bottom}px` : "0px",
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
      {isSelected && !isDragActive && (
        <RowViewMenu rowId={row.id} />
      )}
      <div className={styles.row} style={contentStyle}>
        <div className={styles.inner}>
          {row.columns.map((column) => (
            <ColumnView key={column.id} column={column} rowId={row.id} />
          ))}
        </div>
      </div>

      {isDragActive && (activeDragType === "row" || activeDragType === "saved-row") && (
        <RowDropZones rowId={row.id} />
      )}
    </div>
  );
};
