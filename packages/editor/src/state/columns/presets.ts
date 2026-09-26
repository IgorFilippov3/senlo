/**
 * @fileoverview The column widths of every row layout, in one table.
 *
 * These numbers used to be written out four times - in the `LayoutPreset`
 * union, in a `switch` in `create-columns.ts`, in a second `switch` of
 * hand-written preview divs in `palette-item.tsx`, and in a hand-listed
 * `<PaletteItem>` per case in `rows-section.tsx`. Four places to edit to add one
 * layout, and four places for the numbers to disagree.
 *
 * The test for `createColumns` already opened by declaring exactly this table,
 * which is the usual sign that the source is missing something the test had to
 * supply.
 */
export const LAYOUT_PRESETS = {
  "1col": [100],
  "2col-25-75": [25, 75],
  "2col-75-25": [75, 25],
  "2col-50-50": [50, 50],
  "2col-33-67": [33.33, 66.67],
  "2col-67-33": [66.67, 33.33],
  "3col": [33.33, 33.33, 33.34],
  "4col": [25, 25, 25, 25],
} as const satisfies Record<string, readonly number[]>;

export type LayoutPreset = keyof typeof LAYOUT_PRESETS;

/** The order the palette lists them in: by column count, then by shape. */
export const LAYOUT_PRESET_ORDER = Object.keys(LAYOUT_PRESETS) as LayoutPreset[];
