import { beforeEach, describe, expect, it } from "vitest";

import {
  dragEnd,
  savedRow,
  store,
  twoColumnDesign,
  twoRowDesign,
} from "./fixtures";

beforeEach(() => {
  store().resetEditor();
  store().setDesign(twoRowDesign());
});

describe("nothing under the pointer", () => {
  it("is not a drop", () => {
    store().handleDragEnd(dragEnd({ type: "row", data: "1col" }, null));

    expect(store().design.rows).toHaveLength(2);
    expect(store().isDirty).toBe(false);
  });
});

describe("dragging a layout from the sidebar", () => {
  it("inserts the row at the drop zone's position", () => {
    store().handleDragEnd(
      dragEnd(
        { type: "row", data: "2col-50-50" },
        { id: "row-drop-1", type: "row-drop-zone", position: 1 },
      ),
    );

    const rows = store().design.rows;
    expect(rows.map((r) => r.id)[0]).toBe("row-1");
    expect(rows[1].columns.map((c) => c.width)).toEqual([50, 50]);
    expect(rows[2].id).toBe("row-2");
  });

  it("appends when dropped on the canvas", () => {
    store().handleDragEnd(
      dragEnd({ type: "row", data: "1col" }, { id: "canvas-drop-zone", type: "canvas" }),
    );

    expect(store().design.rows).toHaveLength(3);
    expect(store().design.rows[2].columns).toHaveLength(1);
  });

  it("appends when the drop target only carries the canvas id", () => {
    store().handleDragEnd(dragEnd({ type: "row", data: "1col" }, { id: "canvas-drop-zone" }));

    expect(store().design.rows).toHaveLength(3);
  });

  it("ignores a drop on anything else", () => {
    store().handleDragEnd(
      dragEnd({ type: "row", data: "1col" }, { id: "col-1", type: "column" }),
    );

    expect(store().design.rows).toHaveLength(2);
  });
});

describe("dragging a saved row", () => {
  it("inserts it at the drop zone's position with fresh ids", () => {
    store().handleDragEnd(
      dragEnd(
        { type: "saved-row", data: savedRow() },
        { id: "row-drop-0", type: "row-drop-zone", position: 0 },
      ),
    );

    const added = store().design.rows[0];
    expect(store().design.rows).toHaveLength(3);
    expect(added.id).not.toBe("saved-row");
    expect(added.columns[0].blocks[0].id).not.toBe("saved-block");
    expect((added.columns[0].blocks[0] as any).data.text).toBe("Saved");
  });

  it("appends when dropped on the canvas", () => {
    store().handleDragEnd(
      dragEnd({ type: "saved-row", data: savedRow() }, { id: "canvas-drop-zone", type: "canvas" }),
    );

    expect(store().design.rows).toHaveLength(3);
    expect(store().design.rows[2].columns[0].blocks).toHaveLength(1);
  });
});

describe("dragging a new block from the sidebar", () => {
  it("appends it to the column it was dropped on", () => {
    store().handleDragEnd(
      dragEnd({ type: "content", data: "heading" }, { id: "col-1", type: "column" }),
    );

    const blocks = store().design.rows[0].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "paragraph",
      "heading",
    ]);
  });

  it("inserts it at the drop zone's position", () => {
    store().handleDragEnd(
      dragEnd(
        { type: "content", data: "divider" },
        {
          id: "block-drop-1",
          type: "block-drop-zone",
          columnId: "col-1",
          position: 1,
        },
      ),
    );

    const blocks = store().design.rows[0].columns[0].blocks;
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "divider",
      "paragraph",
    ]);
  });

  it("is not dropped on the canvas: a block needs a column", () => {
    store().handleDragEnd(
      dragEnd({ type: "content", data: "heading" }, { id: "canvas-drop-zone" }),
    );

    expect(store().design.rows[0].columns[0].blocks).toHaveLength(2);
    expect(store().isDirty).toBe(false);
  });
});

describe("dragging a block that is already on the canvas", () => {
  beforeEach(() => {
    store().setDesign(twoColumnDesign());
  });

  const held = (blockId: string, sourceColumnId: string) => ({
    type: "block",
    data: {
      blockId,
      sourceColumnId,
      sourceRowId: "row-1",
      blockType: "paragraph",
    },
  });

  it("moves it to the top of another column", () => {
    store().handleDragEnd(
      dragEnd(held("a1", "col-a"), {
        id: "col-b",
        type: "column",
        columnId: "col-b",
      }),
    );

    const [colA, colB] = store().design.rows[0].columns;
    expect(colA.blocks.map((b) => b.id)).toEqual(["a2"]);
    expect(colB.blocks.map((b) => b.id)).toEqual(["a1", "b1"]);
  });

  it("does nothing when dropped on the column it came from", () => {
    store().handleDragEnd(
      dragEnd(held("a1", "col-a"), {
        id: "col-a",
        type: "column",
        columnId: "col-a",
      }),
    );

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "a1",
      "a2",
    ]);
    expect(store().isDirty).toBe(false);
  });

  it("reorders within its own column through a drop zone", () => {
    store().handleDragEnd(
      dragEnd(held("a1", "col-a"), {
        id: "block-drop",
        type: "block-drop-zone",
        columnId: "col-a",
        position: 2,
      }),
    );

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "a2",
      "a1",
    ]);
  });

  it("moves to another column at the drop zone's position", () => {
    store().handleDragEnd(
      dragEnd(held("a1", "col-a"), {
        id: "block-drop",
        type: "block-drop-zone",
        columnId: "col-b",
        position: 1,
      }),
    );

    const colB = store().design.rows[0].columns[1];
    expect(colB.blocks.map((b) => b.id)).toEqual(["b1", "a1"]);
  });

  it("ignores a drop that is neither a column nor a drop zone", () => {
    store().handleDragEnd(
      dragEnd(held("a1", "col-a"), { id: "canvas-drop-zone", type: "canvas" }),
    );

    expect(store().design.rows[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "a1",
      "a2",
    ]);
    expect(store().isDirty).toBe(false);
  });
});
