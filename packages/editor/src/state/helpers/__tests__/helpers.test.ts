import { describe, expect, it } from "vitest";

import { twoColumnDesign, twoRowDesign } from "../../__tests__/fixtures";
import { findBlock, findBlockOnly } from "../findBlock";
import { findColumn, findColumnOnly } from "../findColumn";

describe("findBlock", () => {
  it("returns the block with the column and row that hold it", () => {
    const result = findBlock(twoRowDesign(), "b3");

    expect(result).not.toBeNull();
    expect(result!.block.id).toBe("b3");
    expect(result!.column.id).toBe("col-2");
    expect(result!.row.id).toBe("row-2");
  });

  it("returns the block's position in its column", () => {
    const design = twoRowDesign();

    expect(findBlock(design, "b1")!.blockIndex).toBe(0);
    expect(findBlock(design, "b2")!.blockIndex).toBe(1);
  });

  it("searches every column of a row", () => {
    const result = findBlock(twoColumnDesign(), "b1");

    expect(result!.column.id).toBe("col-b");
    expect(result!.blockIndex).toBe(0);
  });

  it("returns null for an id that is not there", () => {
    expect(findBlock(twoRowDesign(), "nope")).toBeNull();
  });

  it("returns the same objects the document holds, not copies", () => {
    const design = twoRowDesign();
    const result = findBlock(design, "b1")!;

    expect(result.block).toBe(design.rows[0].columns[0].blocks[0]);
    expect(result.column).toBe(design.rows[0].columns[0]);
    expect(result.row).toBe(design.rows[0]);
  });
});

describe("findBlockOnly", () => {
  it("returns just the block", () => {
    expect(findBlockOnly(twoRowDesign(), "b2")!.id).toBe("b2");
  });

  it("returns null for an id that is not there", () => {
    expect(findBlockOnly(twoRowDesign(), "nope")).toBeNull();
  });
});

describe("findColumn", () => {
  it("returns the column with the row that holds it", () => {
    const result = findColumn(twoRowDesign(), "col-2");

    expect(result!.column.id).toBe("col-2");
    expect(result!.row.id).toBe("row-2");
    expect(result!.columnIndex).toBe(0);
  });

  it("returns the column's position in its row", () => {
    expect(findColumn(twoColumnDesign(), "col-b")!.columnIndex).toBe(1);
  });

  it("returns null for an id that is not there", () => {
    expect(findColumn(twoRowDesign(), "nope")).toBeNull();
  });
});

describe("findColumnOnly", () => {
  it("returns just the column", () => {
    expect(findColumnOnly(twoRowDesign(), "col-1")!.id).toBe("col-1");
  });

  it("returns null for an id that is not there", () => {
    expect(findColumnOnly(twoRowDesign(), "nope")).toBeNull();
  });
});
