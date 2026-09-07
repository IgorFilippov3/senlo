"use client";

import { useDroppable } from "@dnd-kit/core";
import { DropIndicator } from "../drop-indicator/drop-indicator";
import { ContentBlockId, ColumnId } from "@senlo/core";
import styles from "./block-drop-zones.module.css";

interface BlockDropZonesProps {
  blockId: ContentBlockId;
  columnId: ColumnId;
  /**
   * The block's position, passed down by the column. One of these is mounted
   * per block for the duration of a drag, and each used to subscribe to the
   * whole document and scan it to work this out.
   */
  index: number;
}

export const BlockDropZones = ({
  blockId,
  columnId,
  index: blockIndex,
}: BlockDropZonesProps) => {

  const { isOver: isOverTop, setNodeRef: setTopRef } = useDroppable({
    id: `block-drop-zone-before-${blockId}`,
    data: {
      type: "block-drop-zone",
      columnId,
      position: blockIndex,
    },
  });

  const { isOver: isOverBottom, setNodeRef: setBottomRef } = useDroppable({
    id: `block-drop-zone-after-${blockId}`,
    data: {
      type: "block-drop-zone",
      columnId,
      position: blockIndex + 1,
    },
  });

  return (
    <>
      <div ref={setTopRef} className={styles.dropZoneTop}>
        {isOverTop && (
          <div className={styles.indicatorTop}>
            <DropIndicator isVisible={true} />
          </div>
        )}
      </div>

      <div ref={setBottomRef} className={styles.dropZoneBottom}>
        {isOverBottom && (
          <div className={styles.indicatorBottom}>
            <DropIndicator isVisible={true} />
          </div>
        )}
      </div>
    </>
  );
};