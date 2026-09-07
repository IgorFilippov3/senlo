"use client";

import { memo } from "react";
import styles from "./row-view.module.css";
import { evaluateCondition, type RowId } from "@senlo/core";
import { useShallow } from "zustand/react/shallow";
import { ColumnView } from "../column-view/column-view";
import { RowDropZones } from "../row-drop-zones/row-drop-zones";
import { RowViewMenu } from "../row-view-menu/row-view-menu";
import { useEditorStore } from "../../../../state/editor.store";
import { cn } from "@senlo/ui";
import { GitBranch, Repeat } from "lucide-react";

interface RowViewProps {
  rowId: RowId;
  /** Position among the rows, so the drop zones need no lookup of their own. */
  index: number;
  localData?: Record<string, any>;
  isLoopItem?: boolean;
}

/**
 * Takes an id rather than the row object, and subscribes to the pieces it
 * actually draws. Editing a block inside the row changes the row's identity but
 * not its settings or the list of its column ids, so this component - and every
 * sibling row - stays put.
 */
export const RowView = memo(
  ({ rowId, index, localData, isLoopItem }: RowViewProps) => {
    const row = useEditorStore(
      useShallow((s) => {
        const found = s.design.rows.find((r) => r.id === rowId);
        if (!found) return null;

        return {
          settings: found.settings,
          condition: found.condition,
          loop: found.loop,
          columnIds: found.columns.map((c) => c.id).join(" "),
        };
      }),
    );

    const select = useEditorStore((s) => s.select);
    const isSelected = useEditorStore(
      (s) => s.selection?.kind === "row" && s.selection.id === rowId,
    );
    const isDragActive = useEditorStore((s) => s.isDragActive);
    const activeDragType = useEditorStore((s) => s.activeDragType);
    const contentWidth = useEditorStore((s) => s.design.settings?.contentWidth);
    const previewMode = useEditorStore((s) => s.previewMode);
    const previewContact = useEditorStore((s) => s.previewContact);

    if (!row) return null;

    if (previewMode && row.condition) {
      const isVisible = evaluateCondition(row.condition, {
        responsiveStyles: [],
        localData,
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

      if (!isVisible) return null;
    }

    const showAsSelected = isSelected && !isLoopItem;
    const { backgroundColor, padding, borderRadius } = row.settings;
    const columnIds = row.columnIds ? row.columnIds.split(" ") : [];

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      select({ kind: "row", id: rowId });
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
      // These have to match renderRow exactly: a row with no horizontal padding
      // was shown inset by 16px here and sent flush to the edge.
      paddingTop: padding?.top || 0,
      paddingRight: padding?.right || 0,
      paddingBottom: padding?.bottom || 0,
      paddingLeft: padding?.left || 0,
    };

    return (
      <div
        className={cn(styles.rowContainer, showAsSelected && styles.selected)}
        onClick={handleClick}
        style={{ position: "relative" }}
      >
        {showAsSelected && !isDragActive && <RowViewMenu rowId={rowId} />}
        {row.condition && (
          <div
            className={styles.badgeCondition}
            title={`Row Condition: ${row.condition.variable} ${row.condition.operator} ${row.condition.value ?? ""}`}
          >
            <GitBranch size={12} />
          </div>
        )}
        {!previewMode && row.loop && (
          <div
            className={styles.badgeLoop}
            title={`Row Loop: ${row.loop.variable} as ${row.loop.alias}`}
          >
            <Repeat size={12} />
          </div>
        )}
        <div className={styles.row} style={contentStyle}>
          <div className={styles.inner}>
            {columnIds.map((columnId) => (
              <ColumnView
                key={columnId}
                columnId={columnId}
                rowId={rowId}
                localData={localData}
              />
            ))}
          </div>
        </div>

        {isDragActive &&
          (activeDragType === "row" || activeDragType === "saved-row") && (
            <RowDropZones rowId={rowId} index={index} />
          )}
      </div>
    );
  },
);

RowView.displayName = "RowView";
