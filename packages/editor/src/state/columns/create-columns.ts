import { nanoid } from "nanoid";

import type { ColumnBlock, ColumnId } from "@senlo/core";
import { LAYOUT_PRESETS, type LayoutPreset } from "./presets";

/** The columns a layout starts with. The widths come from `presets.ts`. */
export function createColumns(preset: LayoutPreset): ColumnBlock[] {
  return LAYOUT_PRESETS[preset].map((width) => createColumn(width));
}

function createColumn(width: number): ColumnBlock {
  return {
    id: nanoid() as ColumnId,
    width,
    blocks: [],
  };
}
