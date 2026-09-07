// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr, sanitizeUrl } from "../renderer/escape";
import { globalsOf } from "../renderer/types";
import { renderPadding } from "../renderer/utils";
import type { RenderContext } from "../renderer/types";
import {
  alignSchema,
  contentConditionSchema,
  copy,
  paddingSchema,
  urlLikeSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const headingBlockDataSchema = z.object({
  text: z.string().min(1, "Text is required"),
  level: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ])
    .optional(),
  align: alignSchema.optional(),
  color: z.string().optional(),
  fontSize: z.number().positive().optional(),
  lineHeight: z.number().positive().optional(),
  fontWeight: z.enum(["normal", "bold", "bolder"]).optional(),
  href: urlLikeSchema.optional(),
  textTransform: z.enum(["none", "uppercase"]).optional(),
  letterSpacing: z.number().optional(),
  padding: paddingSchema.optional(),
});

export type HeadingBlockData = z.infer<
  typeof headingBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const headingBlockFormSchema = headingBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

/**
 * Size per heading level.
 *
 * The renderer used to emit `font-size: inherit` for a heading with no size of
 * its own, and a column sets 16px, so such a heading arrived at body size - a
 * document from the AI or an import had headings that were not headings. The
 * editor always writes a size, so this only affects documents that never had
 * one, where the old output was wrong rather than intentional.
 */
export const HEADING_FONT_SIZES: Record<number, number> = {
  1: 32,
  2: 24,
  3: 20,
  4: 18,
  5: 16,
  6: 14,
};

export const headingBlockFallbacks = {
  level: 2,
  align: "left" as const,
  /** null means the document's text colour. */
  color: null,
  fontSize: HEADING_FONT_SIZES,
  lineHeight: 1.3,
  fontWeight: "bold" as const,
  textTransform: "none" as const,
  letterSpacing: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderHeading(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  // The level becomes a tag name, so it can never be taken from the document
  // as-is: designJson is JSON and carries no type guarantees.
  const level = Math.min(
    6,
    Math.max(1, Math.trunc(Number(data.level)) || headingBlockFallbacks.level),
  );
  const Tag = `h${level}`;

  const style = [
    `margin: 0`,
    // Outlook's Word engine ignores the `*` selector in the head, so the font
    // has to be written on the element itself or the message falls back to
    // Times New Roman.
    `font-family: ${globals.fontFamily}`,
    `text-align: ${data.align || headingBlockFallbacks.align}`,
    `color: ${data.color || globals.textColor || "inherit"}`,
    `font-size: ${data.fontSize || HEADING_FONT_SIZES[level]}px`,
    `line-height: ${data.lineHeight || headingBlockFallbacks.lineHeight}`,
    `font-weight: ${data.fontWeight || headingBlockFallbacks.fontWeight}`,
    `text-transform: ${data.textTransform || headingBlockFallbacks.textTransform}`,
    `letter-spacing: ${
      data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"
    }`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  // data.text is raw HTML on purpose - the editor lets the author write markup.
  let content = data.text;
  if (data.href) {
    content = `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }))}" target="_blank" style="color: inherit; text-decoration: none;">${content}</a>`;
  }

  return `<${Tag} style="${escapeAttr(style)}">${content}</${Tag}>`;
}

function renderMJMLHeading(block: any): string {
  const { data } = block;
  return `
        <mj-text
          align="${data.align || headingBlockFallbacks.align}"
          color="${data.color || "#000000"}"
          font-size="${data.fontSize || HEADING_FONT_SIZES[Number(data.level) || headingBlockFallbacks.level] || 24}px"
          line-height="${data.lineHeight || headingBlockFallbacks.lineHeight}"
          font-weight="${data.fontWeight || headingBlockFallbacks.fontWeight}"
          text-transform="${data.textTransform || headingBlockFallbacks.textTransform}"
          letter-spacing="${data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"}"
          padding="${renderPadding(data.padding)}"
        >
          ${data.href ? `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }) || "#")}" style="color: inherit; text-decoration: none;">${data.text}</a>` : data.text}
        </mj-text>`;
}

export const headingBlock: BlockDefinition = {
  type: "heading",
  label: "Heading",
  fallbacks: headingBlockFallbacks,
  createDefaults: () => copy({
    text: "Heading",
    level: 2 as const,
    align: "left" as const,
    padding: { top: 16, right: 0, bottom: 16, left: 0 },
  }),
  dataSchema: headingBlockDataSchema,
  renderHTML: renderHeading,
  renderMJML: renderMJMLHeading,
  describe: (block: any) => `Heading: ${String(block.data.text).slice(0, 20)}`,
};
