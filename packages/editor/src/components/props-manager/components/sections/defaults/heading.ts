import { fallbacksFor } from "./common";
import { HEADING_FONT_SIZES } from "@senlo/core";

/**
 * Heading defaults, taken from the block definition so a control shows what
 * the renderer would use.
 */
const fallbacks = fallbacksFor("heading");

export const DEFAULT_HEADING_FONT_SIZES: Record<number, number> =
  HEADING_FONT_SIZES;
export const DEFAULT_HEADING_LINE_HEIGHT = fallbacks.lineHeight;
export const DEFAULT_HEADING_LETTER_SPACING = fallbacks.letterSpacing;
export const DEFAULT_HEADING_FONT_WEIGHT = fallbacks.fontWeight;
export const DEFAULT_HEADING_PADDING = fallbacks.padding;
