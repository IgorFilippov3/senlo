import { describe, expect, it } from "vitest";

import type { LayoutPreset } from "../../../types/layout-preset";
import { createColumns } from "../create-columns";

const WIDTHS: Record<LayoutPreset, number[]> = {
  "1col": [100],
  "2col-25-75": [25, 75],
  "2col-75-25": [75, 25],
  "2col-50-50": [50, 50],
  "2col-33-67": [33.33, 66.67],
  "2col-67-33": [66.67, 33.33],
  "3col": [33.33, 33.33, 33.34],
};

describe("createColumns", () => {
  it.each(Object.keys(WIDTHS) as LayoutPreset[])(
    "gives %s its column widths",
    (preset) => {
      expect(createColumns(preset).map((c) => c.width)).toEqual(WIDTHS[preset]);
    },
  );

  it("adds up to a full row", () => {
    for (const preset of Object.keys(WIDTHS) as LayoutPreset[]) {
      const total = createColumns(preset).reduce((sum, c) => sum + c.width, 0);
      expect(total).toBeCloseTo(100, 5);
    }
  });

  it("starts every column empty", () => {
    expect(createColumns("3col").every((c) => c.blocks.length === 0)).toBe(true);
  });

  it("gives every column its own id", () => {
    const ids = createColumns("3col").map((c) => c.id);

    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("does not repeat ids between calls", () => {
    const first = createColumns("1col")[0].id;
    const second = createColumns("1col")[0].id;

    expect(first).not.toBe(second);
  });
});
