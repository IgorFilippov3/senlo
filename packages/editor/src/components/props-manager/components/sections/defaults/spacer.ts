import { fallbacksFor } from "./common";

const fallbacks = fallbacksFor("spacer");

export const DEFAULT_SPACER_HEIGHT = fallbacks.height;
export const DEFAULT_SPACER_PADDING = fallbacks.padding;

/** Range of the slider. A control's limits are not the document's. */
export const MIN_SPACER_HEIGHT = 0;
export const MAX_SPACER_HEIGHT = 200;
