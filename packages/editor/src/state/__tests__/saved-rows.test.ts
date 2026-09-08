import { beforeEach, describe, expect, it, vi } from "vitest";

import { savedRow, store, twoRowDesign } from "./fixtures";

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoRowDesign());
  store().setSavedRowCallbacks({});
  vi.restoreAllMocks();
});

/** The store reports callback failures to the console; tests do not need them. */
const silenceErrors = () =>
  vi.spyOn(console, "error").mockImplementation(() => {});

describe("the rows sidebar", () => {
  it("loads the library when it switches to the saved rows", () => {
    const onList = vi.fn().mockResolvedValue([savedRow()]);
    store().setSavedRowCallbacks({ onList });

    store().setRowsSidebarMode("saved");

    expect(store().rowsSidebarMode).toBe("saved");
    expect(onList).toHaveBeenCalledTimes(1);
  });

  it("does not load when it switches back", () => {
    const onList = vi.fn().mockResolvedValue([]);
    store().setSavedRowCallbacks({ onList });

    store().setRowsSidebarMode("empty");

    expect(onList).not.toHaveBeenCalled();
  });
});

describe("loadSavedRows", () => {
  it("does nothing without a callback", async () => {
    await store().loadSavedRows();

    expect(store().savedRows).toEqual([]);
    expect(store().isLoadingSavedRows).toBe(false);
  });

  it("stores what the callback returns and lowers the loading flag", async () => {
    const rows = [savedRow(), savedRow({ id: 2, name: "Footer" })];
    store().setSavedRowCallbacks({ onList: vi.fn().mockResolvedValue(rows) });

    await store().loadSavedRows();

    expect(store().savedRows).toEqual(rows);
    expect(store().isLoadingSavedRows).toBe(false);
  });

  it("keeps the previous list and lowers the flag when the callback fails", async () => {
    const errors = silenceErrors();
    store().setSavedRowCallbacks({
      onList: vi.fn().mockRejectedValue(new Error("network")),
    });

    await store().loadSavedRows();

    expect(store().savedRows).toEqual([]);
    expect(store().isLoadingSavedRows).toBe(false);
    expect(errors).toHaveBeenCalled();
  });
});

describe("saveRowToLibrary", () => {
  it("refuses without a callback", async () => {
    await expect(store().saveRowToLibrary("Hero", "row-1")).resolves.toBe(false);
  });

  it("refuses for a row that is not in the document", async () => {
    store().setSavedRowCallbacks({ onSave: vi.fn() });

    await expect(store().saveRowToLibrary("Hero", "nope")).resolves.toBe(false);
  });

  it("sends the row itself and puts the result at the top of the list", async () => {
    const created = savedRow({ id: 7, name: "Hero" });
    const onSave = vi.fn().mockResolvedValue({ success: true, data: created });
    store().setSavedRowCallbacks({ onSave });

    const ok = await store().saveRowToLibrary("Hero", "row-1");

    expect(ok).toBe(true);
    expect(onSave).toHaveBeenCalledWith("Hero", store().design.rows[0]);
    expect(store().savedRows[0]).toEqual(created);
  });

  it("reports a rejected save", async () => {
    store().setSavedRowCallbacks({
      onSave: vi.fn().mockResolvedValue({ success: false }),
    });

    await expect(store().saveRowToLibrary("Hero", "row-1")).resolves.toBe(false);
    expect(store().savedRows).toEqual([]);
  });

  it("reports a failed save", async () => {
    const errors = silenceErrors();
    store().setSavedRowCallbacks({
      onSave: vi.fn().mockRejectedValue(new Error("network")),
    });

    await expect(store().saveRowToLibrary("Hero", "row-1")).resolves.toBe(false);
    expect(errors).toHaveBeenCalled();
  });
});

describe("deleteSavedRow", () => {
  beforeEach(async () => {
    await useSavedRows([savedRow({ id: 1 }), savedRow({ id: 2, name: "Footer" })]);
  });

  function useSavedRows(rows: ReturnType<typeof savedRow>[]) {
    store().setSavedRowCallbacks({
      onList: vi.fn().mockResolvedValue(rows),
    });
    return store().loadSavedRows();
  }

  it("refuses without a callback", async () => {
    store().setSavedRowCallbacks({});

    await expect(store().deleteSavedRow(1)).resolves.toBe(false);
  });

  it("drops the row from the list", async () => {
    store().setSavedRowCallbacks({
      onDelete: vi.fn().mockResolvedValue({ success: true }),
    });

    await expect(store().deleteSavedRow(1)).resolves.toBe(true);
    expect(store().savedRows.map((r) => r.id)).toEqual([2]);
  });

  it("keeps the row when the callback refuses", async () => {
    store().setSavedRowCallbacks({
      onDelete: vi.fn().mockResolvedValue({ success: false }),
    });

    await expect(store().deleteSavedRow(1)).resolves.toBe(false);
    expect(store().savedRows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("keeps the row when the callback fails", async () => {
    const errors = silenceErrors();
    store().setSavedRowCallbacks({
      onDelete: vi.fn().mockRejectedValue(new Error("network")),
    });

    await expect(store().deleteSavedRow(1)).resolves.toBe(false);
    expect(store().savedRows.map((r) => r.id)).toEqual([1, 2]);
    expect(errors).toHaveBeenCalled();
  });
});

describe("addSavedRowToDesign", () => {
  it("appends a copy with fresh ids and selects it", () => {
    store().addSavedRowToDesign(savedRow());

    const added = store().design.rows[2];
    expect(store().design.rows).toHaveLength(3);
    expect(added.id).not.toBe("saved-row");
    expect(added.columns[0].id).not.toBe("saved-col");
    expect(added.columns[0].blocks[0].id).not.toBe("saved-block");
    expect(store().selection).toEqual({ kind: "row", id: added.id });
  });

  it("inserts at a position when given one", () => {
    store().addSavedRowToDesign(savedRow(), 1);

    expect(store().design.rows.map((r) => r.id)[0]).toBe("row-1");
    expect(store().design.rows[2].id).toBe("row-2");
  });

  it("records one history step", () => {
    store().addSavedRowToDesign(savedRow());

    expect(store().historyPast).toHaveLength(1);
    expect(store().isDirty).toBe(true);
  });

  it("does not share blocks with the library entry", () => {
    const entry = savedRow();
    store().addSavedRowToDesign(entry);

    const addedBlockId = store().design.rows[2].columns[0].blocks[0].id;
    store().updateBlock(addedBlockId, { text: "Changed" });

    expect(entry.data.columns[0].blocks[0].data.text).toBe("Saved");
  });
});

describe("resetEditor", () => {
  it("drops the library, which is scoped to a project", async () => {
    store().setSavedRowCallbacks({
      onList: vi.fn().mockResolvedValue([savedRow()]),
    });
    await store().loadSavedRows();
    store().setRowsSidebarMode("saved");

    store().resetEditor();

    expect(store().savedRows).toEqual([]);
    expect(store().rowsSidebarMode).toBe("empty");
    expect(store().isLoadingSavedRows).toBe(false);
  });
});
