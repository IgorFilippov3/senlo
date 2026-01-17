"use client";

import React, { useMemo } from "react";
import { RowBlock, renderRow, RenderContext } from "@senlo/core";
import styles from "./row-thumbnail.module.css";

interface RowThumbnailProps {
  row: RowBlock;
}

export const RowThumbnail = ({ row }: RowThumbnailProps) => {
  const html = useMemo(() => {
    const context: RenderContext = {
      responsiveStyles: [],
      options: {
        baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    };
    return renderRow(row, context);
  }, [row]);

  return (
    <div className={styles.thumbnailContainer}>
      <div className={styles.thumbnailScaler}>
        <div
          className={styles.thumbnailContent}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};
