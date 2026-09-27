"use client";

import { memo } from "react";
import styles from "./row-view.module.css";
import {
  evaluateCondition,
  rowBackground,
  rowBorder,
  type RowId,
} from "@senlo/core";
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
    const { padding, borderRadius, margin, fullWidth } = row.settings;

    // What paints behind the row comes from the renderer's own module rather
    // than being derived here a second time. A row, unlike a block, does not
    // reach this canvas through the renderer, and the two descriptions of its
    // chrome have drifted apart before - see the padding comment below, which
    // is what that cost last time.
    const background = rowBackground(row.settings);

    // The rule comes from the same module and goes on the same element as the
    // background - the band for a full-width row, the row's own box otherwise.
    const border = rowBorder(row.settings);
    const columnIds = row.columnIds ? row.columnIds.split(" ") : [];

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      select({ kind: "row", id: rowId });
    };

    // The document's width is the row's default and its ceiling, the same rule
    // `renderRow` applies when it builds the message.
    const documentWidth = contentWidth || 600;
    const rowWidth = Math.min(
      Number(row.settings.width) || documentWidth,
      documentWidth,
    );

    // And the side gap comes out of that width, exactly as it does in
    // `renderRow` - see the comment there for why the padding alone is not
    // enough. A full-width row is left alone: its band takes the gap instead.
    const sideGap = fullWidth
      ? 0
      : (Number(margin?.left) || 0) + (Number(margin?.right) || 0);
    const renderedWidth = Math.max(rowWidth - sideGap, 1);

    const radii: React.CSSProperties = {
      borderTopLeftRadius:
        borderRadius?.top !== undefined ? `${borderRadius.top}px` : "0px",
      borderTopRightRadius:
        borderRadius?.top !== undefined ? `${borderRadius.top}px` : "0px",
      borderBottomLeftRadius:
        borderRadius?.bottom !== undefined ? `${borderRadius.bottom}px` : "0px",
      borderBottomRightRadius:
        borderRadius?.bottom !== undefined ? `${borderRadius.bottom}px` : "0px",
    };

    // A full-width row paints its background across the whole message while its
    // content stays at `rowWidth`, so the background belongs to the band and
    // not to the row - exactly the split `renderRow` makes.
    const bandStyle: React.CSSProperties = fullWidth
      ? { ...background, ...border, ...radii }
      : {};

    const contentStyle: React.CSSProperties = {
      maxWidth: `${renderedWidth}px`,
      margin: "0 auto",
      width: "100%",
      ...(fullWidth
        ? {}
        : { ...background, ...border, ...radii }),
      // These have to match renderRow exactly: a row with no horizontal padding
      // was shown inset by 16px here and sent flush to the edge.
      paddingTop: padding?.top || 0,
      paddingRight: padding?.right || 0,
      paddingBottom: padding?.bottom || 0,
      paddingLeft: padding?.left || 0,
    };

    // The gap outside the background, which `renderRow` emits as a cell around
    // the row. Here it is padding on the container, so the space belongs to
    // this row - hovering it still selects this row, and the gap moves with it.
    const containerStyle: React.CSSProperties = {
      position: "relative",
      paddingTop: margin?.top || 0,
      paddingRight: margin?.right || 0,
      paddingBottom: margin?.bottom || 0,
      paddingLeft: margin?.left || 0,
    };

    return (
      <div
        className={cn(styles.rowContainer, showAsSelected && styles.selected)}
        onClick={handleClick}
        style={containerStyle}
      >
        {/* The menu and the badges anchor to the row, not to the container,
            so an outer gap does not leave them floating in it. */}
        <div className={styles.anchor}>
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
          <div className={styles.band} style={bandStyle}>
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
