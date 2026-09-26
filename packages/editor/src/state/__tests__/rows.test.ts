import { beforeEach, describe, expect, it } from "vitest";

import { column, design, row, store, twoRowDesign } from "./fixtures";

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoRowDesign());
});

describe("addRow", () => {
  it("appends a row with the columns of the preset and selects it", () => {
    store().addRow("2col-50-50");

    const rows = store().design.rows;
    expect(rows).toHaveLength(3);
    expect(rows[2].columns.map((c) => c.width)).toEqual([50, 50]);
    expect(store().selection).toEqual({ kind: "row", id: rows[2].id });
  });

  it("records one history step and marks the document unsaved", () => {
    store().addRow("1col");

    expect(store().historyPast).toHaveLength(1);
    expect(store().isDirty).toBe(true);
  });

  it("gives the row the default settings the renderer expects", () => {
    store().addRow("1col");

    expect(store().design.rows[2].settings).toEqual({
      backgroundColor: "#ffffff",
      fullWidth: false,
      align: "center",
      padding: { top: 0, right: 16, bottom: 0, left: 16 },
    });
  });
});

describe("addRowAtPosition", () => {
  it("inserts at the given index", () => {
    store().addRowAtPosition("1col", 0);

    const ids = store().design.rows.map((r) => r.id);
    expect(ids.slice(1)).toEqual(["row-1", "row-2"]);
    expect(store().selection).toEqual({ kind: "row", id: ids[0] });
  });

  it("appends when no position is given", () => {
    store().addRowAtPosition("1col");

    expect(store().design.rows[2].id).toBe(store().design.rows.at(-1)!.id);
    expect(store().design.rows).toHaveLength(3);
  });
});

describe("removeRow", () => {
  it("removes the row", () => {
    store().removeRow("row-1");

    expect(store().design.rows.map((r) => r.id)).toEqual(["row-2"]);
    expect(store().historyPast).toHaveLength(1);
  });

  it("clears the selection when the removed row was selected", () => {
    store().select({ kind: "row", id: "row-1" });
    store().removeRow("row-1");

    expect(store().selection).toBeNull();
  });

  it("keeps a selection that points at another row", () => {
    store().select({ kind: "row", id: "row-2" });
    store().removeRow("row-1");

    expect(store().selection).toEqual({ kind: "row", id: "row-2" });
  });

  it("leaves a block selection pointing into the row it just removed", () => {
    // Current behaviour: only a row selection is cleared, so a block that was
    // selected inside the row survives as a dangling selection.
    store().select({
      kind: "block",
      id: "b1",
      columnId: "col-1",
      rowId: "row-1",
    });
    store().removeRow("row-1");

    expect(store().selection).toEqual({
      kind: "block",
      id: "b1",
      columnId: "col-1",
      rowId: "row-1",
    });
  });

  it("still records a history step for an id that is not there", () => {
    // Current behaviour: history is recorded before the recipe runs, so a
    // no-op removal costs an undo step.
    store().removeRow("nope");

    expect(store().design.rows).toHaveLength(2);
    expect(store().historyPast).toHaveLength(1);
    expect(store().isDirty).toBe(true);
  });
});

describe("duplicateRow", () => {
  it("inserts the copy right after the original and selects it", () => {
    store().duplicateRow("row-1");

    const rows = store().design.rows;
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id)[2]).toBe("row-2");
    expect(store().selection).toEqual({ kind: "row", id: rows[1].id });
  });

  it("gives the row, its columns and its blocks fresh ids", () => {
    store().duplicateRow("row-1");

    const [original, copy] = store().design.rows;
    expect(copy.id).not.toBe(original.id);
    expect(copy.columns[0].id).not.toBe(original.columns[0].id);
    expect(copy.columns[0].blocks.map((b) => b.id)).not.toEqual(
      original.columns[0].blocks.map((b) => b.id),
    );
  });

  it("copies the content", () => {
    store().duplicateRow("row-1");

    const copy = store().design.rows[1];
    expect(copy.columns[0].blocks.map((b: any) => b.data.text)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("does not let an edit of the copy reach the original", () => {
    store().duplicateRow("row-1");
    const copyBlockId = store().design.rows[1].columns[0].blocks[0].id;

    store().updateBlock(copyBlockId, { text: "Changed" });

    const original: any = store().design.rows[0].columns[0].blocks[0];
    expect(original.data.text).toBe("First");
  });
});

describe("moveRow", () => {
  it("moves a row down and keeps it selected", () => {
    store().moveRow("row-1", "down");

    expect(store().design.rows.map((r) => r.id)).toEqual(["row-2", "row-1"]);
    expect(store().selection).toEqual({ kind: "row", id: "row-1" });
  });

  it("moves a row up", () => {
    store().moveRow("row-2", "up");

    expect(store().design.rows.map((r) => r.id)).toEqual(["row-2", "row-1"]);
  });

  it("does nothing at the edges", () => {
    store().moveRow("row-1", "up");
    store().moveRow("row-2", "down");

    expect(store().design.rows.map((r) => r.id)).toEqual(["row-1", "row-2"]);
    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(false);
  });

  it("does nothing for an unknown id", () => {
    store().moveRow("nope", "down");

    expect(store().historyPast).toHaveLength(0);
  });
});

describe("updateRow", () => {
  it("merges the settings and records one step", () => {
    store().updateRow("row-1", { backgroundColor: "#000000" });

    expect(store().design.rows[0].settings.backgroundColor).toBe("#000000");
    expect(store().historyPast).toHaveLength(1);
    expect(store().isDirty).toBe(true);
  });

  it("does nothing when the values are the ones already there", () => {
    store().updateRow("row-1", { backgroundColor: "#000000" });
    store().updateRow("row-1", { backgroundColor: "#000000" });

    expect(store().historyPast).toHaveLength(1);
  });

  it("stores the outer spacing without touching the row's own padding", () => {
    store().updateRow("row-1", {
      padding: { top: 8, right: 8, bottom: 8, left: 8 },
      margin: { top: 0, right: 0, bottom: 24, left: 0 },
    });

    const settings = store().design.rows[0].settings;

    // Two separate spaces: `padding` is inside the row's background, `margin`
    // is the gap outside it. Merging them would paint the gap in the row's
    // colour.
    expect(settings.padding).toEqual({ top: 8, right: 8, bottom: 8, left: 8 });
    expect(settings.margin).toEqual({ top: 0, right: 0, bottom: 24, left: 0 });
  });

  it("stores the condition and the loop it is given", () => {
    store().updateRow(
      "row-1",
      {},
      { variable: "contact.plan", operator: "equals", value: "pro" },
      { variable: "custom.items", alias: "item" },
    );

    expect(store().design.rows[0].condition).toEqual({
      variable: "contact.plan",
      operator: "equals",
      value: "pro",
    });
    expect(store().design.rows[0].loop).toEqual({
      variable: "custom.items",
      alias: "item",
    });
  });

  it("clears an existing condition when called without one", () => {
    // Current behaviour: condition and loop are always overwritten, so a
    // settings-only update from a caller that does not pass them drops them.
    store().updateRow("row-1", {}, {
      variable: "contact.plan",
      operator: "is_set",
    });

    store().updateRow("row-1", { backgroundColor: "#ffffff" });

    expect(store().design.rows[0].condition).toBeUndefined();
  });

  it("does nothing for an unknown row", () => {
    store().updateRow("nope", { backgroundColor: "#000000" });

    expect(store().historyPast).toHaveLength(0);
  });
});

describe("updateRowWithoutHistory", () => {
  it("applies the change and marks the document unsaved without a history step", () => {
    store().updateRowWithoutHistory("row-1", { backgroundColor: "#123456" });

    expect(store().design.rows[0].settings.backgroundColor).toBe("#123456");
    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(true);
  });
});

describe("an empty document", () => {
  it("takes a first row", () => {
    store().setDesign(design([]));
    store().addRow("3col");

    expect(store().design.rows).toHaveLength(1);
    expect(store().design.rows[0].columns).toHaveLength(3);
  });
});

describe("setColumnWidths", () => {
  const threeColumns = () =>
    design([
      row("row-1", [
        column("col-1", [], 33.33),
        column("col-2", [], 33.33),
        column("col-3", [], 33.34),
      ]),
    ]);

  beforeEach(() => {
    store().resetEditor();
    store().setDesign(threeColumns());
  });

  it("writes the widths onto the row's columns", () => {
    store().setColumnWidths("row-1", [50, 20, 30]);

    expect(store().design.rows[0].columns.map((c) => c.width)).toEqual([
      50, 20, 30,
    ]);
  });

  it("records one history step, so the change can be undone", () => {
    store().setColumnWidths("row-1", [50, 20, 30]);

    expect(store().historyPast).toHaveLength(1);
    expect(store().isDirty).toBe(true);

    store().undo();
    expect(store().design.rows[0].columns.map((c) => c.width)).toEqual([
      33.33, 33.33, 33.34,
    ]);
  });

  it("does nothing when the widths are the ones already there", () => {
    store().setColumnWidths("row-1", [33.33, 33.33, 33.34]);

    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(false);
  });

  it("refuses a list that does not match the row's columns", () => {
    // A short list would leave the last column with an undefined width, which
    // renders as a full-width column and is very hard to trace back here.
    store().setColumnWidths("row-1", [50, 50]);
    store().setColumnWidths("row-1", [25, 25, 25, 25]);
    store().setColumnWidths("row-1", [50, NaN, 20]);

    expect(store().design.rows[0].columns.map((c) => c.width)).toEqual([
      33.33, 33.33, 33.34,
    ]);
    expect(store().historyPast).toHaveLength(0);
  });

  it("ignores a row that is not there", () => {
    store().setColumnWidths("nope", [50, 20, 30]);

    expect(store().historyPast).toHaveLength(0);
  });

  it("has a no-history variant for a value still being dragged", () => {
    store().setColumnWidthsWithoutHistory("row-1", [50, 20, 30]);

    expect(store().design.rows[0].columns.map((c) => c.width)).toEqual([
      50, 20, 30,
    ]);
    expect(store().historyPast).toHaveLength(0);
    // Still an edit, though: the unsaved-changes guard has to see it.
    expect(store().isDirty).toBe(true);
  });
});
