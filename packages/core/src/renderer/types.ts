import type { EmailDesignDocument, GlobalSettings } from "../emailDesign";

export interface EmailRenderer {
  render(design: EmailDesignDocument): string;
}

/**
 * Global settings resolved once per render, so every block can write them
 * inline. Outlook's Word engine ignores the `*` selector in the head, which is
 * why font-family has to be repeated on each element rather than declared once.
 */
export interface ResolvedGlobals {
  fontFamily: string;
  textColor?: string;
  contentWidth: number;
}

export type RenderContext = {
  // To store shared state during rendering (e.g. unique classes for media queries)
  responsiveStyles: string[];
  options?: RenderOptions;
  localData?: Record<string, any>;
  /** Absent when a caller builds a context only to evaluate a condition. */
  globals?: ResolvedGlobals;
};

export const DEFAULT_FONT_FAMILY = "Arial, Helvetica, sans-serif";
export const DEFAULT_CONTENT_WIDTH = 600;

export function resolveGlobals(settings?: GlobalSettings): ResolvedGlobals {
  return {
    fontFamily: settings?.fontFamily || DEFAULT_FONT_FAMILY,
    textColor: settings?.textColor,
    contentWidth: Number(settings?.contentWidth) || DEFAULT_CONTENT_WIDTH,
  };
}

/** Globals for a context that was built without them. */
export function globalsOf(context: RenderContext): ResolvedGlobals {
  return context.globals ?? resolveGlobals();
}

export interface RenderOptions {
  baseUrl?: string;
  /**
   * Hidden preview text shown by inboxes next to the subject line. Without it
   * they fall back to whatever the first block happens to say.
   */
  preheader?: string;
  /** Document title. Used by "view in browser" pages, not by inboxes. */
  title?: string;
  /**
   * Cap on how many times a looped row may repeat. Loop data can come from the
   * public trigger API, where an unbounded array is a denial of service.
   */
  maxLoopIterations?: number;
  data?: {
    contact?: Record<string, any>;
    project?: { name: string };
    workspace?: { name: string };
    campaign?: { name: string; id?: number };
    trigger?: { name: string; id?: number };
    unsubscribeUrl?: string;
    custom?: Record<string, any>;
    local?: Record<string, any>; // Used internally or for nested manual data
  };
}

/** Default value for {@link RenderOptions.maxLoopIterations}. */
export const MAX_LOOP_ITERATIONS = 1000;
