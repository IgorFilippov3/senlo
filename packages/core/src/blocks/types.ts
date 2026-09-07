// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import type { ContentBlock, ContentBlockType } from "../emailDesign";
import type { RenderContext, RenderOptions } from "../renderer/types";

/**
 * Everything the application needs to know about one block type, in one place.
 *
 * Before this existed, adding a block meant editing thirteen files, four of
 * them `switch` statements that fail silently when a case is missing - which is
 * how `socials` ended up without a label in the canvas. A definition is
 * registered once and every consumer looks it up.
 *
 * React lives in the editor's half of the registry
 * (`@senlo/editor`): this package renders email, and must not depend on it.
 */
export interface BlockDefinition<TData = any> {
  type: ContentBlockType;

  /** Name shown in the sidebar and in drag overlays. */
  label: string;

  /**
   * Data for a newly inserted block. A factory, not a constant: a shared
   * object would be frozen by immer on first insert and then mutated through
   * every later copy.
   */
  createDefaults: () => TData;

  /**
   * What rendering assumes when a field is absent.
   *
   * Distinct from `createDefaults`, and the distinction matters. Defaults are
   * an opinion about a new block and can be as opinionated as we like.
   * Fallbacks describe documents that already exist - an older template, an
   * import, AI output - so changing one changes mail that is already being
   * sent. Keep them conservative.
   *
   * The property panel reads the same values, so a control shows what would
   * actually be sent rather than a second opinion. Those two sets used to
   * disagree: the panel offered a list 10/0/10/24 padding where the renderer
   * fell back to zero, so the editor promised an indent the recipient never
   * saw.
   *
   * `null` for a colour means "the document's text colour".
   */
  fallbacks: Record<string, any>;

  /**
   * The single schema for this block's `data`. Used to validate a stored
   * document, to validate AI output, and by the editor's property form.
   *
   * Numeric limits that only exist because a slider has a range belong to the
   * control, not here: this schema also has to accept every document that was
   * saved before that control existed.
   */
  dataSchema: z.ZodType<any>;

  /** Render to the HTML that is actually sent. */
  renderHTML: (block: any, context: RenderContext) => string;

  /** Render to MJML, for the export dialog. */
  renderMJML: (block: any, options?: RenderOptions) => string;

  /** One-line description used by the canvas overlay and drag preview. */
  describe?: (block: any) => string;
}

/** Narrower alias used where a definition is looked up by a block instance. */
export type AnyBlockDefinition = BlockDefinition<ContentBlock["data"]>;
