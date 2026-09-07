import { fallbacksFor } from "./common";

const fallbacks = fallbacksFor("list");

export const DEFAULT_LIST_TYPE = fallbacks.listType;
export const DEFAULT_LIST_FONT_SIZE = fallbacks.fontSize;
export const DEFAULT_LIST_LINE_HEIGHT = fallbacks.lineHeight;
export const DEFAULT_LIST_FONT_WEIGHT = fallbacks.fontWeight;
export const DEFAULT_LIST_ALIGN = fallbacks.align;
export const DEFAULT_LIST_PADDING = fallbacks.padding;

/** Items only exist for a new block, so this one is a default, not a fallback. */
export const DEFAULT_LIST_ITEMS = ["List item 1", "List item 2", "List item 3"];
