import { beforeEach, describe, expect, it } from "vitest";

import {
  column,
  design,
  row,
  store,
  twoColumnDesign,
  twoRowDesign,
} from "./fixtures";

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoRowDesign());
});

describe("addBlock", () => {
  it("appends to the first column of the last row and selects the block", () => {
    store().addBlock("heading");

    const blocks = store().design.rows[1].columns[0].blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[1].type).toBe("heading");
    expect(store().selection).toEqual({
      kind: "block",
      id: blocks[1].id,
      columnId: "col-2",
      rowId: "row-2",
    });
  });

  it("takes the defaults from the block definition", () => {
    store().addBlock("heading");

    const block: any = store().design.rows[1].columns[0].blocks[1];
    expect(block.data.text).toBe("Heading");
    expect(block.data.level).toBe(2);
  });

  it("creates a row for a document that has none", () => {
    store().setDesign(design([]));
    store().addBlock("paragraph");

    expect(store().design.rows).toHaveLength(1);
    expect(store().design.rows[0].columns[0].blocks).toHaveLength(1);
  });

  it("creates a column for a row that has none", () => {
    store().setDesign(design([row("row-1", [])]));
    store().addBlock("paragraph");

    const columns = store().design.rows[0].columns;
    expect(columns).toHaveLength(1);
    expect(columns[0].blocks).toHaveLength(1);
  });
});

describe("addBlockToColumn", () => {
  it("appends when no position is given", () => {
    store().addBlockToColumn("divider", "col-1");

    const blocks = store().design.rows[0].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
      "divider",
    ]);
  });

  it("inserts at the given position", () => {
    store().addBlockToColumn("divider", "col-1", 1);

    const blocks = store().design.rows[0].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "divider",
      "paragraph",
    ]);
  });

  it("appends when the position is past the end of the column", () => {
    store().addBlockToColumn("divider", "col-1", 99);

    const blocks = store().design.rows[0].columns[0].blocks;
    expect(blocks[2].type).toBe("divider");
  });

  it("records the block's row and column in the selection", () => {
    store().addBlockToColumn("spacer", "col-2");

    const selection: any = store().selection;
    expect(selection).toMatchObject({
      kind: "block",
      columnId: "col-2",
      rowId: "row-2",
    });
  });

  it("adds nothing for an unknown column", () => {
    store().addBlockToColumn("spacer", "nope");

    expect(store().design.rows[0].columns[0].blocks).toHaveLength(2);
    expect(store().design.rows[1].columns[0].blocks).toHaveLength(1);
  });
});

describe("removeBlockFromColumn", () => {
  it("removes the block", () => {
    store().removeBlockFromColumn("b1", "col-1");

    const blocks = store().design.rows[0].columns[0].blocks;
    expect(blocks.map((b) => b.id)).toEqual(["b2"]);
  });

  it("clears the selection when the removed block was selected", () => {
    store().select({
      kind: "block",
      id: "b1",
      columnId: "col-1",
      rowId: "row-1",
    });
    store().removeBlockFromColumn("b1", "col-1");

    expect(store().selection).toBeNull();
  });

  it("finds the block even when the column it is told is wrong", () => {
    // The column argument is not used for the lookup: findBlock walks the
    // document by block id.
    store().removeBlockFromColumn("b1", "col-2");

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "b2",
    ]);
  });
});

describe("duplicateBlock", () => {
  it("inserts the copy right after the original with a new id", () => {
    store().duplicateBlock("b1", "col-1");

    const blocks = store().design.rows[0].columns[0].blocks;
    expect(blocks).toHaveLength(3);
    expect(blocks[1].id).not.toBe("b1");
    expect((blocks[1] as any).data.text).toBe("First");
    expect(blocks[2].id).toBe("b2");
  });

  it("selects the copy", () => {
    store().duplicateBlock("b1", "col-1");

    const copyId = store().design.rows[0].columns[0].blocks[1].id;
    expect(store().selection).toEqual({
      kind: "block",
      id: copyId,
      columnId: "col-1",
      rowId: "row-1",
    });
  });

  it("does not let an edit of the copy reach the original", () => {
    store().duplicateBlock("b1", "col-1");
    const copyId = store().design.rows[0].columns[0].blocks[1].id;

    store().updateBlock(copyId, { text: "Changed" });

    const original: any = store().design.rows[0].columns[0].blocks[0];
    expect(original.data.text).toBe("First");
  });
});

describe("moveBlockWithinColumn", () => {
  it("moves a block down, accounting for the gap it leaves behind", () => {
    store().setDesign(
      design([
        row("row-1", [
          column("col-1", [
            { id: "b1", type: "paragraph", data: { text: "1" } },
            { id: "b2", type: "paragraph", data: { text: "2" } },
            { id: "b3", type: "paragraph", data: { text: "3" } },
          ]),
        ]),
      ]),
    );

    store().moveBlockWithinColumn("b1", "col-1", 2);

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "b2",
      "b1",
      "b3",
    ]);
  });

  it("moves a block up", () => {
    store().moveBlockWithinColumn("b2", "col-1", 0);

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "b2",
      "b1",
    ]);
  });

  it("keeps the moved block selected", () => {
    store().moveBlockWithinColumn("b2", "col-1", 0);

    expect(store().selection).toEqual({
      kind: "block",
      id: "b2",
      columnId: "col-1",
      rowId: "row-1",
    });
  });

  it("does nothing for an unknown block", () => {
    store().moveBlockWithinColumn("nope", "col-1", 0);

    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(false);
  });
});

describe("moveBlockBetweenColumns", () => {
  beforeEach(() => {
    store().setDesign(twoColumnDesign());
  });

  it("moves the block to the target column at the given position", () => {
    store().moveBlockBetweenColumns("a1", "col-a", "col-b", 0);

    const [colA, colB] = store().design.rows[0].columns;
    expect(colA.blocks.map((b) => b.id)).toEqual(["a2"]);
    expect(colB.blocks.map((b) => b.id)).toEqual(["a1", "b1"]);
  });

  it("puts the block at the end when the position is past it", () => {
    store().moveBlockBetweenColumns("a1", "col-a", "col-b", 99);

    const colB = store().design.rows[0].columns[1];
    expect(colB.blocks.map((b) => b.id)).toEqual(["b1", "a1"]);
  });

  it("keeps the moved block selected with its new column", () => {
    store().moveBlockBetweenColumns("a1", "col-a", "col-b", 0);

    expect(store().selection).toEqual({
      kind: "block",
      id: "a1",
      columnId: "col-b",
      rowId: "row-1",
    });
  });

  it("moves a block across rows", () => {
    store().setDesign(twoRowDesign());

    store().moveBlockBetweenColumns("b1", "col-1", "col-2", 0);

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "b2",
    ]);
    expect(store().design.rows[1].columns[0].blocks.map((b) => b.id)).toEqual([
      "b1",
      "b3",
    ]);
  });

  it("changes nothing when the target column does not exist", () => {
    store().moveBlockBetweenColumns("a1", "col-a", "nope", 0);

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "a1",
      "a2",
    ]);
  });
});

describe("updateBlock", () => {
  it("merges the fields it is given", () => {
    store().updateBlock("b1", { align: "center" } as any);

    const block: any = store().design.rows[0].columns[0].blocks[0];
    expect(block.data).toEqual({ text: "First", align: "center" });
  });

  it("does nothing when nothing changed", () => {
    store().updateBlock("b1", { text: "First" });

    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(false);
  });

  it("records a step when only the condition changed", () => {
    store().updateBlock("b1", { text: "First" }, {
      variable: "contact.plan",
      operator: "is_set",
    });

    expect(store().historyPast).toHaveLength(1);
    expect(store().design.rows[0].columns[0].blocks[0].condition).toEqual({
      variable: "contact.plan",
      operator: "is_set",
    });
  });

  it("clears an existing condition when called without one", () => {
    // Same overwrite rule as rows: the condition is always replaced by the
    // argument, so a data-only update from a caller that omits it drops it.
    store().updateBlock("b1", { text: "First" }, {
      variable: "contact.plan",
      operator: "is_set",
    });

    store().updateBlock("b1", { text: "Second" });

    expect(store().design.rows[0].columns[0].blocks[0].condition).toBeUndefined();
  });

  it("does nothing for an unknown block", () => {
    store().updateBlock("nope", { text: "x" });

    expect(store().historyPast).toHaveLength(0);
  });
});

describe("updateBlockWithoutHistory", () => {
  it("applies the change and marks the document unsaved without a history step", () => {
    store().updateBlockWithoutHistory("b1", { text: "Typing" });

    const block: any = store().design.rows[0].columns[0].blocks[0];
    expect(block.data.text).toBe("Typing");
    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(true);
  });

  it("writes the condition the form is editing alongside the data", () => {
    store().updateBlockWithoutHistory("b1", { text: "Typing" }, {
      variable: "contact.plan",
      operator: "is_set",
    });

    expect(store().design.rows[0].columns[0].blocks[0].condition).toEqual({
      variable: "contact.plan",
      operator: "is_set",
    });
  });

  it("clears the condition when the form no longer has one", () => {
    store().updateBlockWithoutHistory("b1", { text: "Typing" }, {
      variable: "contact.plan",
      operator: "is_set",
    });

    store().updateBlockWithoutHistory("b1", { text: "Typing more" });

    expect(
      store().design.rows[0].columns[0].blocks[0].condition,
    ).toBeUndefined();
  });

  it("ignores an unknown block", () => {
    store().updateBlockWithoutHistory("nope", { text: "x" });

    expect(store().isDirty).toBe(false);
  });
});
