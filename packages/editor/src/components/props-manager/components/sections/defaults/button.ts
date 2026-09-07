import { fallbacksFor } from "./common";

const fallbacks = fallbacksFor("button");

export const DEFAULT_BUTTON_FONT_SIZE = fallbacks.fontSize;
export const DEFAULT_BUTTON_FONT_WEIGHT = fallbacks.fontWeight;
export const DEFAULT_BUTTON_COLOR = fallbacks.color;
export const DEFAULT_BUTTON_BG_COLOR = fallbacks.backgroundColor;
export const DEFAULT_BUTTON_BORDER_RADIUS = fallbacks.borderRadius;
export const DEFAULT_BUTTON_PADDING = fallbacks.padding;
export const DEFAULT_BUTTON_LETTER_SPACING = fallbacks.letterSpacing;
export const DEFAULT_BUTTON_BORDER = fallbacks.border;

/** Presets offered by the shadow control. Editor-only: the renderer has none. */
export const SHADOW_PRESETS = {
  none: { x: 0, y: 0, blur: 0, color: "#000000" },
  s: { x: 0, y: 4, blur: 8, color: "#00000033" },
  m: { x: 0, y: 8, blur: 16, color: "#00000040" },
  l: { x: 0, y: 16, blur: 32, color: "#00000040" },
} as const;

export type ShadowPresetKey = keyof typeof SHADOW_PRESETS;
