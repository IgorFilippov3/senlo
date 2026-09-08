import { fallbacksFor } from "./common";

const fallbacks = fallbacksFor("product-line");

export const DEFAULT_PRODUCT_LINE_RIGHT_WIDTH = fallbacks.rightWidth;
export const DEFAULT_PRODUCT_LINE_PADDING = fallbacks.padding;
export const DEFAULT_PRODUCT_LINE_ROW_PADDING = fallbacks.rowPadding;
export const DEFAULT_PRODUCT_LINE_DIVIDER = fallbacks.divider;
export const DEFAULT_PRODUCT_LINE_LEFT_STYLE = fallbacks.leftStyle;
export const DEFAULT_PRODUCT_LINE_RIGHT_STYLE = fallbacks.rightStyle;

/** Placeholder text for an empty line. */
export const DEFAULT_PRODUCT_LINE_LEFT_TEXT = "Product name";
export const DEFAULT_PRODUCT_LINE_RIGHT_TEXT = "$99.99";
