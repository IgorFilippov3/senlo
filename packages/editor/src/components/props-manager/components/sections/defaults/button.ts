/**
 * Default values specific to Button blocks
 */
export const DEFAULT_BUTTON_FONT_SIZE = 16;
export const DEFAULT_BUTTON_FONT_WEIGHT = "bold";
export const DEFAULT_BUTTON_COLOR = "#ffffff";
export const DEFAULT_BUTTON_BG_COLOR = "#3b82f6"; // blue-500
export const DEFAULT_BUTTON_BORDER_RADIUS = 4;
export const DEFAULT_BUTTON_PADDING = {
  top: 12,
  right: 24,
  bottom: 12,
  left: 24,
};
export const DEFAULT_BUTTON_LETTER_SPACING = 0;

export const DEFAULT_BUTTON_BORDER = {
  width: 0,
  top: undefined as number | undefined,
  right: undefined as number | undefined,
  bottom: undefined as number | undefined,
  left: undefined as number | undefined,
  style: "solid" as const,
  color: "#000000",
};

export const SHADOW_PRESETS = {
  none: { x: 0, y: 0, blur: 0, color: "#000000" },
  s: { x: 0, y: 4, blur: 8, color: "#00000033" },
  m: { x: 0, y: 8, blur: 16, color: "#00000040" },
  l: { x: 0, y: 16, blur: 32, color: "#00000040" },
} as const;

export type ShadowPresetKey = keyof typeof SHADOW_PRESETS;
