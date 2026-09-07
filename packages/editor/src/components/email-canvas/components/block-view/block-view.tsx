"use client";

import { memo } from "react";
import styles from "./block-view.module.css";
import {
  describeBlock,
  evaluateCondition,
  type ColumnId,
  type ContentBlockId,
  type RowId,
} from "@senlo/core";
import { useEditorStore } from "../../../../state/editor.store";
import { cn } from "@senlo/ui";
import { useDraggable } from "@dnd-kit/core";
import { BlockDropZones } from "../block-drop-zones/block-drop-zones";
import { BlockViewMenu } from "../block-view-menu/block-view-menu";
import { RenderedBlock } from "./rendered-block";
import { GitBranch } from "lucide-react";

interface BlockViewProps {
  blockId: ContentBlockId;
  columnId: ColumnId;
  rowId: RowId;
  /** Position within the column, so the drop zones need no lookup. */
  index: number;
  localData?: Record<string, any>;
}

/** Sample values shown where a merge tag sits, in preview mode. */
const previewDataFor = (previewContact: Record<string, any> | null) => ({
  contact: previewContact || {},
  custom: previewContact || {},
  workspace: { name: "Sample Workspace" },
  trigger: { name: "Sample Trigger" },
  unsubscribeUrl: "https://senlo.io/unsubscribe/sample-token",
});

export const BlockView = memo(
  ({ blockId, columnId, rowId, index, localData }: BlockViewProps) => {
    // Selecting the block by id keeps its identity stable while a sibling is
    // edited: immer shares the untouched nodes, so this returns the very same
    // object and the component does not re-render.
    const block = useEditorStore((s) => {
      const row = s.design.rows.find((r) => r.id === rowId);
      const column = row?.columns.find((c) => c.id === columnId);
      return column?.blocks.find((b) => b.id === blockId) ?? null;
    });

    // A boolean, not the selection object: `select()` builds a new object every
    // time, which used to re-render every block on the canvas whenever the
    // selection moved.
    const isSelected = useEditorStore(
      (s) => s.selection?.kind === "block" && s.selection.id === blockId,
    );

    const select = useEditorStore((s) => s.select);
    const isDragActive = useEditorStore((s) => s.isDragActive);
    const activeDragType = useEditorStore((s) => s.activeDragType);
    const previewMode = useEditorStore((s) => s.previewMode);
    const previewContact = useEditorStore((s) => s.previewContact);
    const settings = useEditorStore((s) => s.design.settings);

    const previewData = previewDataFor(previewContact);

    // Only computed here - the early return has to happen after every hook
    // call, otherwise flipping a block's visibility changes the number of hooks
    // between renders and React tears the whole tree down.
    const isHiddenByCondition =
      previewMode && block?.condition
        ? !evaluateCondition(block.condition, {
            responsiveStyles: [],
            localData,
            options: { data: previewData },
          })
        : false;

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: `block-${blockId}`,
      data: {
        type: "block",
        data: {
          blockId,
          sourceColumnId: columnId,
          sourceRowId: rowId,
          blockType: block?.type,
          blockData: block,
        },
        label: block ? describeBlock(block) : "Block",
      },
    });

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // The block's own markup is real email HTML, links included. Selecting a
      // block must not navigate away from the editor.
      e.preventDefault();
      select({ kind: "block", id: blockId, columnId, rowId });
    };

    // Safe from here on: every hook above has been called.
    if (!block || isHiddenByCondition) {
      return null;
    }

    return (
      <div style={{ position: "relative" }}>
        {block.condition && (
          <div
            className={styles.conditionBadge}
            title={`Condition: ${block.condition.variable} ${block.condition.operator} ${block.condition.value ?? ""}`}
          >
            <GitBranch size={10} />
          </div>
        )}

        <div
          ref={setNodeRef}
          className={cn(
            styles.block,
            isSelected && styles.selected,
            isDragging && styles.dragging,
          )}
          onClick={handleClick}
          style={{ opacity: isDragging ? 0.3 : 1 }}
          {...listeners}
          {...attributes}
        >
          <RenderedBlock
            block={block}
            settings={settings}
            previewMode={previewMode}
            previewData={previewData}
            localData={localData}
          />
        </div>

        {isDragActive &&
          (activeDragType === "block" || activeDragType === "content") && (
            <BlockDropZones
              blockId={blockId}
              columnId={columnId}
              index={index}
            />
          )}
        {isSelected && !isDragActive && (
          <BlockViewMenu blockId={blockId} columnId={columnId} />
        )}
      </div>
    );
  },
);

BlockView.displayName = "BlockView";
