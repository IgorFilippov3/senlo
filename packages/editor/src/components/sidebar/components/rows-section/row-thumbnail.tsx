"use client";

import React, { useMemo } from "react";
import { RowBlock, renderRow, RenderContext } from "@senlo/core";
import styles from "./row-thumbnail.module.css";
import { useEditorHost } from "../../../../host";

interface RowThumbnailProps {
  row: RowBlock;
}

export const RowThumbnail = ({ row }: RowThumbnailProps) => {
  const { baseUrl } = useEditorHost();
  const html = useMemo(() => {
    const context: RenderContext = {
      responsiveStyles: [],
      options: {
        baseUrl,
      },
    };
    return renderRow(row, context);
  }, [baseUrl, row]);

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
