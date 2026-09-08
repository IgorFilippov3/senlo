import { beforeEach, describe, expect, it } from "vitest";

import { column, design, row, store, twoRowDesign } from "./fixtures";

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoRowDesign());
});

describe("select", () => {
  it("stores a row selection", () => {
    store().select({ kind: "row", id: "row-1" });

    expect(store().selection).toEqual({ kind: "row", id: "row-1" });
  });

  it("stores a column selection with its row", () => {
    store().select({ kind: "column", id: "col-1", rowId: "row-1" });

    expect(store().selection).toEqual({
      kind: "column",
      id: "col-1",
      rowId: "row-1",
    });
  });

  it("clears", () => {
    store().select({ kind: "row", id: "row-1" });
    store().clearSelection();

    expect(store().selection).toBeNull();
  });

  it("is not an edit", () => {
    store().select({ kind: "row", id: "row-1" });

    expect(store().isDirty).toBe(false);
    expect(store().historyPast).toHaveLength(0);
  });
});

describe("selectNext", () => {
  it("starts at the first block when nothing is selected", () => {
    store().selectNext();

    expect(store().selection).toEqual({
      kind: "block",
      id: "b1",
      columnId: "col-1",
      rowId: "row-1",
    });
  });

  it("starts at the first row when that row has no blocks", () => {
    store().setDesign(
      design([row("row-1", [column("col-1")]), row("row-2", [column("col-2")])]),
    );

    store().selectNext();

    expect(store().selection).toEqual({ kind: "row", id: "row-1" });
  });

  it("does nothing on an empty document", () => {
    store().setDesign(design([]));
    store().selectNext();

    expect(store().selection).toBeNull();
  });

  it("walks the blocks across rows and columns", () => {
    store().select({
      kind: "block",
      id: "b2",
      columnId: "col-1",
      rowId: "row-1",
    });

    store().selectNext();

    expect(store().selection).toEqual({
      kind: "block",
      id: "b3",
      columnId: "col-2",
      rowId: "row-2",
    });
  });

  it("stays put on the last block", () => {
    store().select({
      kind: "block",
      id: "b3",
      columnId: "col-2",
      rowId: "row-2",
    });

    store().selectNext();

    expect((store().selection as any).id).toBe("b3");
  });

  it("moves between rows when a row is selected", () => {
    store().select({ kind: "row", id: "row-1" });
    store().selectNext();

    expect(store().selection).toEqual({ kind: "row", id: "row-2" });
  });

  it("stays put on the last row", () => {
    store().select({ kind: "row", id: "row-2" });
    store().selectNext();

    expect(store().selection).toEqual({ kind: "row", id: "row-2" });
  });

  it("leaves a column selection alone", () => {
    store().select({ kind: "column", id: "col-1", rowId: "row-1" });
    store().selectNext();

    expect(store().selection).toEqual({
      kind: "column",
      id: "col-1",
      rowId: "row-1",
    });
  });
});

describe("selectPrevious", () => {
  it("does nothing when nothing is selected", () => {
    store().selectPrevious();

    expect(store().selection).toBeNull();
  });

  it("walks the blocks backwards across rows", () => {
    store().select({
      kind: "block",
      id: "b3",
      columnId: "col-2",
      rowId: "row-2",
    });

    store().selectPrevious();

    expect(store().selection).toEqual({
      kind: "block",
      id: "b2",
      columnId: "col-1",
      rowId: "row-1",
    });
  });

  it("stays put on the first block", () => {
    store().select({
      kind: "block",
      id: "b1",
      columnId: "col-1",
      rowId: "row-1",
    });

    store().selectPrevious();

    expect((store().selection as any).id).toBe("b1");
  });

  it("moves between rows and stops at the first one", () => {
    store().select({ kind: "row", id: "row-2" });
    store().selectPrevious();
    expect(store().selection).toEqual({ kind: "row", id: "row-1" });

    store().selectPrevious();
    expect(store().selection).toEqual({ kind: "row", id: "row-1" });
  });
});

describe("undo and redo", () => {
  it("drop the selection, because the element may be gone", () => {
    store().select({ kind: "row", id: "row-1" });
    store().updateBlock("b1", { text: "Edited" });
    store().select({ kind: "row", id: "row-1" });

    store().undo();
    expect(store().selection).toBeNull();

    store().select({ kind: "row", id: "row-1" });
    store().redo();
    expect(store().selection).toBeNull();
  });
});
