import { describe, expect, it } from "vitest";

import { createColumns } from "../create-columns";
import {
  LAYOUT_PRESETS,
  LAYOUT_PRESET_ORDER,
  type LayoutPreset,
} from "../presets";

// The widths used to be declared here as well as in the source, which is how
// this file came to hold the table `presets.ts` was missing. It reads the real
// one now, so a layout added there is covered here without being typed twice.
const WIDTHS = LAYOUT_PRESETS as Record<LayoutPreset, readonly number[]>;

describe("createColumns", () => {
  it.each(LAYOUT_PRESET_ORDER)("gives %s its column widths", (preset) => {
    expect(createColumns(preset).map((c) => c.width)).toEqual([
      ...WIDTHS[preset],
    ]);
  });

  it("adds up to a full row", () => {
    for (const preset of LAYOUT_PRESET_ORDER) {
      const total = createColumns(preset).reduce((sum, c) => sum + c.width, 0);
      expect(total).toBeCloseTo(100, 5);
    }
  });

  it("offers a four-column layout", () => {
    expect(createColumns("4col")).toHaveLength(4);
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
