import type { DragEndEvent } from "@dnd-kit/core";
import type {
  ColumnBlock,
  ContentBlock,
  EmailDesignDocument,
  RowBlock,
  SavedRow,
} from "@senlo/core";
import { EMPTY_EMAIL_DESIGN } from "@senlo/core";

import { useEditorStore } from "../editor.store";

/**
 * Builders for the documents the store tests run against.
 *
 * The store is a module singleton, so every test reaches it through `store()`
 * and starts from `resetEditor()` + `setDesign(...)`.
 */
export const store = () => useEditorStore.getState();

export function paragraph(id: string, text: string): ContentBlock {
  return { id, type: "paragraph", data: { text } };
}

export function column(
  id: string,
  blocks: ContentBlock[] = [],
  width = 100,
): ColumnBlock {
  return { id, width, blocks };
}

export function row(id: string, columns: ColumnBlock[]): RowBlock {
  return { id, type: "row", settings: {}, columns };
}

export function design(rows: RowBlock[]): EmailDesignDocument {
  return { ...EMPTY_EMAIL_DESIGN, rows };
}

/** Two rows, each with a single column, so edits can be isolated to one. */
export function twoRowDesign(): EmailDesignDocument {
  return design([
    row("row-1", [
      column("col-1", [paragraph("b1", "First"), paragraph("b2", "Second")]),
    ]),
    row("row-2", [column("col-2", [paragraph("b3", "Third")])]),
  ]);
}

/** One row with two columns, for moves that cross a column boundary. */
export function twoColumnDesign(): EmailDesignDocument {
  return design([
    row("row-1", [
      column("col-a", [paragraph("a1", "A1"), paragraph("a2", "A2")], 50),
      column("col-b", [paragraph("b1", "B1")], 50),
    ]),
  ]);
}

export function savedRow(overrides: Partial<SavedRow> = {}): SavedRow {
  return {
    id: 1,
    userId: "user-1",
    projectId: 1,
    name: "Hero",
    data: row("saved-row", [
      column("saved-col", [paragraph("saved-block", "Saved")]),
    ]),
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

/**
 * A dnd-kit drag end event, cut down to the fields the store actually reads:
 * the dragged item's `type`/`data`, and the drop target's id and data.
 */
export function dragEnd(
  active: { id?: string; type: string; data?: any },
  over: ({ id?: string } & Record<string, any>) | null,
): DragEndEvent {
  const { id: overId = "over", ...overData } = over ?? {};

  return {
    active: {
      id: active.id ?? "active",
      data: { current: { type: active.type, data: active.data } },
    },
    over: over ? { id: overId, data: { current: overData } } : null,
  } as unknown as DragEndEvent;
}
