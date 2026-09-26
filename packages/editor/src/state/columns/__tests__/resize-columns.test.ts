import { describe, expect, it } from "vitest";

import {
  MIN_COLUMN_WIDTH,
  normalizeWidths,
  resizeColumns,
} from "../resize-columns";

const sum = (widths: number[]) => widths.reduce((a, b) => a + b, 0);

describe("normalizeWidths", () => {
  it("rounds the stored thirds into whole percents", () => {
    expect(normalizeWidths([33.33, 33.33, 33.34])).toEqual([33, 33, 34]);
  });

  it("always adds up to a hundred", () => {
    for (const widths of [
      [100],
      [25, 75],
      [33.33, 66.67],
      [33.33, 33.33, 33.34],
      [25, 25, 25, 25],
      [46, 18, 14, 22],
      [1, 1, 1],
      [10, 20, 30, 40, 50],
    ]) {
      expect(sum(normalizeWidths(widths)), widths.join("/")).toBe(100);
    }
  });

  it("gives the remainder to whoever lost the most to rounding", () => {
    // Three equal columns cannot be whole percents; the extra point has to go
    // somewhere, and going somewhere predictable is the whole requirement.
    expect(normalizeWidths([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it("splits evenly when there is nothing to go on", () => {
    expect(normalizeWidths([0, 0, 0, 0])).toEqual([25, 25, 25, 25]);
    expect(normalizeWidths([NaN, NaN])).toEqual([50, 50]);
  });

  it("leaves whole percents that already add up alone", () => {
    expect(normalizeWidths([46, 18, 14, 22])).toEqual([46, 18, 14, 22]);
  });

  it("has nothing to say about an empty row", () => {
    expect(normalizeWidths([])).toEqual([]);
  });
});

describe("resizeColumns", () => {
  it("takes from the column on the right", () => {
    expect(resizeColumns([50, 50], 0, 70)).toEqual([70, 30]);
  });

  it("gives back to the column on the right", () => {
    expect(resizeColumns([70, 30], 0, 40)).toEqual([40, 60]);
  });

  it("lets the last column move the boundary on its left", () => {
    // Otherwise the rightmost column is the one column nobody can drag.
    expect(resizeColumns([25, 25, 25, 25], 3, 40)).toEqual([25, 25, 10, 40]);
  });

  it("leaves every other column untouched", () => {
    // Column 0 widens into column 1; columns 2 and 3 are not part of the
    // boundary and must not move to make room.
    expect(resizeColumns([46, 18, 14, 22], 0, 40)).toEqual([40, 24, 14, 22]);
  });

  it("stops at the floor rather than taking the whole neighbour", () => {
    // Column 1 is asked for 30, but its pair with column 2 is only 32 wide, so
    // it gets 22 and column 2 keeps the minimum.
    expect(resizeColumns([46, 18, 14, 22], 1, 30)).toEqual([46, 22, 10, 22]);
  });

  it("keeps the row at a hundred whatever it is asked", () => {
    const widths = [46, 18, 14, 22];
    for (let index = 0; index < widths.length; index += 1) {
      for (const next of [-50, 0, 1, 12, 50, 99, 1000, 33.7]) {
        const result = resizeColumns(widths, index, next);
        expect(sum(result), `${index} -> ${next}`).toBe(100);
      }
    }
  });

  it("never drags a column below the floor, on either side", () => {
    expect(resizeColumns([50, 50], 0, 200)).toEqual([90, 10]);
    expect(resizeColumns([50, 50], 0, -200)).toEqual([10, 90]);
    expect(MIN_COLUMN_WIDTH).toBe(10);
  });

  it("normalises before it moves, so a legacy row edits in whole percents", () => {
    expect(resizeColumns([33.33, 33.33, 33.34], 0, 50)).toEqual([50, 16, 34]);
  });

  it("has nothing to move in a single-column row", () => {
    expect(resizeColumns([100], 0, 50)).toEqual([100]);
  });

  it("returns the widths unchanged when asked for nonsense", () => {
    expect(resizeColumns([50, 50], 5, 30)).toEqual([50, 50]);
    expect(resizeColumns([50, 50], -1, 30)).toEqual([50, 50]);
    expect(resizeColumns([50, 50], 0, NaN)).toEqual([50, 50]);
  });

  it("leaves a pair too narrow to split alone", () => {
    // 8 + 7 cannot become two columns of at least 10 whatever it is asked.
    expect(resizeColumns([8, 7, 85], 0, 12)).toEqual([8, 7, 85]);
  });

  it("is stable: asking for what is already there changes nothing", () => {
    const widths = [46, 18, 14, 22];
    expect(resizeColumns(widths, 0, 46)).toEqual(widths);
    expect(resizeColumns(widths, 2, 14)).toEqual(widths);
  });
});
