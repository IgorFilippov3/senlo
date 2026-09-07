import { BLOCK_REGISTRY, type ContentBlockType } from "@senlo/core";

/**
 * What a control shows when the block has no value of its own.
 *
 * These come from the block definition, so a control offers the value the
 * renderer would actually use. They used to be a separate set of constants
 * kept here, and the two had drifted: the panel offered a list 10/0/10/24
 * padding where the renderer fell back to zero, so the editor promised an
 * indent that no recipient ever saw.
 *
 * A `null` colour means "the document's text colour" - the panel resolves it
 * against the global settings, the renderer inherits it.
 */
export function fallbacksFor<T = any>(type: ContentBlockType): T {
  return BLOCK_REGISTRY[type].fallbacks as T;
}

/**
 * Colour to show in a picker for a field whose fallback is the document's own
 * text colour.
 */
export function resolveColor(
  value: string | undefined,
  globalTextColor: string | undefined,
): string {
  return value || globalTextColor || "#000000";
}

/**
 * Common alignment options used across multiple block types
 */
export const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
] as const;

/** Kept for controls whose block has no padding fallback of its own. */
export const DEFAULT_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

export const DEFAULT_COLOR = "#000000";
