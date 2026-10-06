"use client";

import { FormField } from "@senlo/ui";
import type { RowBlock } from "@senlo/core";

import { useEditorStore } from "../../../../state/editor.store";
import styles from "./column-picker.module.css";

interface ColumnPickerProps {
  row: RowBlock;
  /** The column whose settings are open, if any. */
  focusedColumnId?: string;
}

/**
 * The way into a column's own settings.
 *
 * On the canvas a column is selected by clicking the part of it no block
 * covers, and a column whose blocks fill it has no such part - which, in a row
 * of evenly filled columns, is every one of them. The panel is where an author
 * looks for settings, so the row lists its columns here and one click opens
 * one. Clicking the open one again goes back to the row.
 */
export const ColumnPicker = ({ row, focusedColumnId }: ColumnPickerProps) => {
  const select = useEditorStore((s) => s.select);

  const count = row.columns.length;

  return (
    <FormField
      label={count > 1 ? "Column style" : "Column"}
      hint={
        focusedColumnId
          ? "Editing this column's card above. Click it again to return to the row."
          : "Give a column its own background, border and spacing - a card for a KPI, a feature or a price."
      }
    >
      <div className={styles.list} role="group" aria-label="Columns">
        {row.columns.map((column, i) => {
          const active = column.id === focusedColumnId;
          const background = column.settings?.backgroundColor;
          const styled = Boolean(
            column.settings && Object.keys(column.settings).length > 0,
          );

          return (
            <button
              key={column.id}
              type="button"
              className={`${styles.item} ${active ? styles.active : ""}`}
              aria-pressed={active}
              title={styled ? "This column has its own style" : undefined}
              onClick={() =>
                select(
                  active
                    ? { kind: "row", id: row.id }
                    : { kind: "column", id: column.id, rowId: row.id },
                )
              }
            >
              <span
                className={`${styles.swatch} ${styled ? styles.styled : ""}`}
                style={background ? { backgroundColor: background } : undefined}
                aria-hidden
              />
              {count > 1 ? `Column ${i + 1}` : "Edit column"}
            </button>
          );
        })}
      </div>
    </FormField>
  );
};
