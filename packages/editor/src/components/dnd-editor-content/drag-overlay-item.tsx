"use client";

import styles from "../sidebar/components/palette-item/palette-item.module.css";
import { LayoutPreset } from "../../types/layout-preset";
import { ContentBlockType } from "@senlo/core";
import { GripVertical } from "lucide-react";

interface DragOverlayItemProps {
  preset?: LayoutPreset;
  blockType?: ContentBlockType;
  label: string;
  width: number;
  isBlock?: boolean;
  isSavedRow?: boolean;
}

export const DragOverlayItem = ({
  preset,
  blockType,
  label,
  width,
  isBlock = false,
  isSavedRow = false,
}: DragOverlayItemProps) => {
  const renderPreview = () => {
    if (!preset) return null;

    switch (preset) {
      case "1col":
        return <div className={styles.previewCol} style={{ width: "100%" }} />;

      case "2col-25-75":
        return (
          <>
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(25% - 1px)" }}
            />
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(75% - 1px)" }}
            />
          </>
        );

      case "2col-75-25":
        return (
          <>
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(75% - 1px)" }}
            />
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(25% - 1px)" }}
            />
          </>
        );

      case "2col-50-50":
        return (
          <>
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(50% - 1px)" }}
            />
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(50% - 1px)" }}
            />
          </>
        );

      case "2col-33-67":
        return (
          <>
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(33.33% - 1px)" }}
            />
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(66.67% - 1px)" }}
            />
          </>
        );

      case "2col-67-33":
        return (
          <>
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(66.67% - 1px)" }}
            />
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(33.33% - 1px)" }}
            />
          </>
        );

      case "3col":
        return (
          <>
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(33.33% - 1.33px)" }}
            />
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(33.33% - 1.33px)" }}
            />
            <div
              className={styles.previewCol}
              style={{ flex: "0 0 calc(33.34% - 1.33px)" }}
            />
          </>
        );
    }
  };

  const renderContentOverlay = () => {
    if (!isBlock && !blockType) return null;

    return (
      <div
        style={{
          height: "50px",
          backgroundColor: "#fafafa",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#333",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
          border: "1px solid rgba(0, 0, 0, 0.1)",
          gap: "6px",
          padding: "10px",
        }}
      >
        <GripVertical size={16} />
        <span>Content Block</span>
      </div>
    );
  };

  const renderSavedRowOverlay = () => {
    return (
      <div
        style={{
          height: "60px",
          backgroundColor: "#fafafa",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#333",
          fontSize: "14px",
          fontWeight: "600",
          boxShadow: "0 2px 12px rgba(0, 0, 0, 0.2)",
          border: "2px solid var(--sl-color-primary)",
          gap: "8px",
          padding: "0 20px",
          width: "100%",
        }}
      >
        <GripVertical size={18} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>
    );
  };

  const isContentItem = isBlock || blockType;
  const isRowItem = preset || isSavedRow;

  return (
    <div
      className={styles.item}
      style={{
        width: isContentItem ? "160px" : isSavedRow ? "240px" : `${width}px`,
        opacity: isContentItem || isSavedRow ? 0.95 : 0.9,
        transform: isContentItem || isSavedRow ? "none" : "rotate(2deg)",
        background: isContentItem || isSavedRow ? "transparent" : undefined,
        border: isContentItem || isSavedRow ? "none" : undefined,
        padding: isContentItem || isSavedRow ? "0" : undefined,
      }}
    >
      {isContentItem
        ? renderContentOverlay()
        : isSavedRow
          ? renderSavedRowOverlay()
          : preset && <div className={styles.preview}>{renderPreview()}</div>}
    </div>
  );
};
