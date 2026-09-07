import { describe, it, expect, beforeEach } from "vitest";
import { EMPTY_EMAIL_DESIGN, type EmailDesignDocument } from "@senlo/core";
import { useEditorStore } from "../editor.store";

const store = () => useEditorStore.getState();

/** Two rows, each with a single column, so edits can be isolated to one. */
function twoRowDesign(): EmailDesignDocument {
  return {
    ...EMPTY_EMAIL_DESIGN,
    rows: [
      {
        id: "row-1",
        type: "row",
        settings: {},
        columns: [
          {
            id: "col-1",
            width: 100,
            blocks: [
              { id: "b1", type: "paragraph", data: { text: "First" } },
              { id: "b2", type: "paragraph", data: { text: "Second" } },
            ],
          },
        ],
      },
      {
        id: "row-2",
        type: "row",
        settings: {},
        columns: [
          {
            id: "col-2",
            width: 100,
            blocks: [{ id: "b3", type: "paragraph", data: { text: "Third" } }],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoRowDesign());
});

describe("history", () => {
  it("starts clean", () => {
    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(false);
    expect(store().canUndo).toBe(false);
  });

  it("records the previous document and restores it", () => {
    store().updateBlock("b1", { text: "Edited" });

    expect(store().historyPast).toHaveLength(1);
    expect(store().isDirty).toBe(true);

    store().undo();

    const block = store().design.rows[0].columns[0].blocks[0] as any;
    expect(block.data.text).toBe("First");
  });

  it("redoes what it undid", () => {
    store().updateBlock("b1", { text: "Edited" });
    store().undo();
    store().redo();

    const block = store().design.rows[0].columns[0].blocks[0] as any;
    expect(block.data.text).toBe("Edited");
  });

  it("shares structure with the previous version instead of cloning it", () => {
    // The point of the change: a history entry costs only the nodes that
    // actually differ. Editing a block in row 1 must leave row 2 as the very
    // same object in both versions.
    const before = store().design;
    store().updateBlock("b1", { text: "Edited" });
    const after = store().design;

    expect(store().historyPast[0]).toBe(before);
    expect(after.rows[1]).toBe(before.rows[1]);
    expect(after.rows[0]).not.toBe(before.rows[0]);
  });

  it("keeps keys whose value is undefined", () => {
    // JSON cloning silently dropped them, so a border that had been cleared
    // came back as a different shape after an undo.
    store().updateBlock("b1", { padding: { top: 1, bottom: undefined } as any });
    store().updateBlock("b1", { text: "Later" });
    store().undo();

    const block = store().design.rows[0].columns[0].blocks[0] as any;
    expect("bottom" in block.data.padding).toBe(true);
  });

  it("caps how far back it goes", () => {
    for (let i = 0; i < 60; i++) {
      store().updateBlock("b1", { text: `Edit ${i}` });
    }

    expect(store().historyPast).toHaveLength(50);
  });

  it("clears the redo stack once a new change is made", () => {
    store().updateBlock("b1", { text: "One" });
    store().undo();
    expect(store().canRedo).toBe(true);

    store().updateBlock("b1", { text: "Two" });
    expect(store().historyFuture).toHaveLength(0);
    expect(store().canRedo).toBe(false);
  });
});

describe("dirty flag", () => {
  it("is set by edits that do not record history", () => {
    store().updateBlockWithoutHistory("b1", { text: "Typing" });

    expect(store().isDirty).toBe(true);
    expect(store().historyPast).toHaveLength(0);
  });

  it("is cleared when a document is loaded", () => {
    store().updateBlock("b1", { text: "Edited" });
    store().setDesign(twoRowDesign());

    expect(store().isDirty).toBe(false);
  });
});

describe("selection", () => {
  it("records the column and row a block sits in", () => {
    store().select({
      kind: "block",
      id: "b3",
      columnId: "col-2",
      rowId: "row-2",
    });

    expect(store().selection).toEqual({
      kind: "block",
      id: "b3",
      columnId: "col-2",
      rowId: "row-2",
    });
  });

  it("fills in the parents when the store selects a block itself", () => {
    store().addBlockToColumn("heading", "col-2");

    const selection = store().selection as any;
    expect(selection.kind).toBe("block");
    expect(selection.columnId).toBe("col-2");
    expect(selection.rowId).toBe("row-2");
  });
});

describe("moving a block", () => {
  it("does nothing when the block is dropped where it already is", () => {
    store().moveBlockWithinColumn("b1", "col-1", 0);
    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(false);

    store().moveBlockWithinColumn("b1", "col-1", 1);
    expect(store().historyPast).toHaveLength(0);
  });

  it("reorders and records one step when the position changes", () => {
    store().moveBlockWithinColumn("b1", "col-1", 2);

    const ids = store().design.rows[0].columns[0].blocks.map((b) => b.id);
    expect(ids).toEqual(["b2", "b1"]);
    expect(store().historyPast).toHaveLength(1);
  });
});

describe("resetEditor", () => {
  it("clears the document, history and selection", () => {
    store().updateBlock("b1", { text: "Edited" });
    store().select({ kind: "row", id: "row-1" });
    store().resetEditor();

    expect(store().design.rows).toHaveLength(0);
    expect(store().historyPast).toHaveLength(0);
    expect(store().selection).toBeNull();
    expect(store().isDirty).toBe(false);
  });
});
