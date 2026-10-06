import { beforeEach, describe, expect, it } from "vitest";

import { store, twoColumnDesign } from "./fixtures";

const CARD = {
  backgroundColor: "#f8f8fc",
  border: { width: 1, style: "solid" as const, color: "#e4e4f0" },
  borderRadius: 10,
  padding: { top: 14, right: 16, bottom: 14, left: 16 },
};

const columnOf = (id: string) =>
  store().design.rows[0].columns.find((c) => c.id === id)!;

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoColumnDesign());
});

describe("updateColumn", () => {
  it("styles one column and leaves its neighbour alone", () => {
    store().updateColumn("row-1", "col-a", CARD);

    expect(columnOf("col-a").settings).toEqual(CARD);
    expect(columnOf("col-b").settings).toBeUndefined();
  });

  it("records one history step and undoes to an unstyled column", () => {
    store().updateColumn("row-1", "col-a", CARD);
    expect(store().historyPast).toHaveLength(1);

    store().undo();
    expect(columnOf("col-a").settings).toBeUndefined();
  });

  it("adds no history step when nothing changed", () => {
    store().updateColumn("row-1", "col-a", {});
    expect(store().historyPast).toHaveLength(0);
  });

  it("replaces rather than merges, so a cleared field goes away", () => {
    store().updateColumn("row-1", "col-a", CARD);
    store().updateColumn("row-1", "col-a", { backgroundColor: "#fff" });

    expect(columnOf("col-a").settings).toEqual({ backgroundColor: "#fff" });
  });

  it("ignores a column that is not in the row", () => {
    store().updateColumn("row-1", "missing", CARD);
    expect(store().historyPast).toHaveLength(0);
  });
});

describe("updateColumnWithoutHistory", () => {
  it("changes the document and marks it unsaved without a history step", () => {
    store().updateColumnWithoutHistory("row-1", "col-b", CARD);

    expect(columnOf("col-b").settings).toEqual(CARD);
    expect(store().historyPast).toHaveLength(0);
    expect(store().isDirty).toBe(true);
  });
});

describe("duplicateRow", () => {
  it("carries the column's card to the copy", () => {
    store().updateColumn("row-1", "col-a", CARD);
    store().duplicateRow("row-1");

    expect(store().design.rows[1].columns[0].settings).toEqual(CARD);
  });
});
