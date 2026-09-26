"use client";

import { useEffect, useRef, useState } from "react";
import { FormField } from "@senlo/ui";
import type { RowBlock } from "@senlo/core";

import { useEditorStore } from "../../../../state/editor.store";
import {
  MIN_COLUMN_WIDTH,
  normalizeWidths,
  resizeColumns,
} from "../../../../state/columns/resize-columns";
import styles from "./column-widths.module.css";

interface ColumnWidthsProps {
  row: RowBlock;
  /** The column the author clicked on the canvas, if they got here that way. */
  focusedColumnId?: string;
}

/**
 * How a row is divided: one field per column, editing a boundary rather than a
 * number.
 *
 * There was a proportional bar above these fields, showing the same widths
 * drawn to scale. It carried the percentages too, so on any row it read as the
 * same values twice - most obviously on two columns, where the bar's segments
 * came out roughly the width of the fields beneath them and the whole thing
 * looked like a duplicated line. A picture of the proportions is worth having,
 * but not at the cost of a second set of numbers, and not before the fields
 * themselves are plainly the place values live.
 */
export const ColumnWidths = ({ row, focusedColumnId }: ColumnWidthsProps) => {
  const setColumnWidths = useEditorStore((s) => s.setColumnWidths);
  const setColumnWidthsWithoutHistory = useEditorStore(
    (s) => s.setColumnWidthsWithoutHistory,
  );

  const stored = row.columns.map((c) => c.width);

  // Rows created before this control carry `33.33 / 33.33 / 33.34`; they are
  // shown as whole percents, and the document keeps its own numbers until the
  // author actually moves something.
  const widths = normalizeWidths(stored);
  const count = widths.length;

  // What the fields show while one is being typed in. A field the author has
  // half-finished must not be overwritten by the store on every keystroke.
  const [draft, setDraft] = useState<Record<number, string>>({});
  const debounce = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setDraft({});
  }, [row.id, count]);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  const apply = (index: number, next: number) => {
    const resized = resizeColumns(widths, index, next);

    // The live write keeps the canvas in step with the field; the history step
    // waits until the author stops, so holding an arrow key does not fill undo
    // with one entry per percent.
    setColumnWidthsWithoutHistory(row.id, resized);

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setColumnWidths(row.id, resized);
    }, 400);
  };

  if (count < 2) return null;

  return (
    <FormField
      label="Columns"
      hint={`Each column gives up what its neighbour takes, so the row always adds up. On a phone all ${count} stack to full width.`}
    >
      <div className={styles.fields}>
          {widths.map((width, i) => (
            <div
              key={row.columns[i].id}
              className={`${styles.field} ${
                row.columns[i].id === focusedColumnId ? styles.focused : ""
              }`}
            >
              <input
                type="number"
                min={MIN_COLUMN_WIDTH}
                max={100 - MIN_COLUMN_WIDTH}
                className={styles.input}
                aria-label={`Column ${i + 1} width`}
                value={draft[i] ?? String(width)}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, [i]: e.target.value }));
                  const parsed = Number(e.target.value);
                  if (e.target.value !== "" && Number.isFinite(parsed)) {
                    apply(i, parsed);
                  }
                }}
                onBlur={() => setDraft((d) => ({ ...d, [i]: undefined as any }))}
              />
              <span className={styles.unit}>%</span>
            </div>
          ))}
      </div>
    </FormField>
  );
};
