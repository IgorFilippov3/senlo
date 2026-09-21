// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr, sanitizeUrl } from "../renderer/escape";
import { globalsOf } from "../renderer/types";
import { renderBox, renderMJMLBox, renderPadding } from "../renderer/utils";
import type { RenderContext } from "../renderer/types";
import {
  alignSchema,
  boxFallbacks,
  boxFields,
  contentConditionSchema,
  copy,
  paddingSchema,
  urlLikeSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const paragraphBlockDataSchema = z.object({
  text: z.string().min(1, "Text is required"),
  align: alignSchema.optional(),
  color: z.string().optional(),
  fontSize: z.number().positive().optional(),
  lineHeight: z.number().positive().optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  href: urlLikeSchema.optional(),
  textTransform: z.enum(["none", "uppercase"]).optional(),
  letterSpacing: z.number().optional(),
  padding: paddingSchema.optional(),
  ...boxFields,
});

export type ParagraphBlockData = z.infer<
  typeof paragraphBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const paragraphBlockFormSchema = paragraphBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const paragraphBlockFallbacks = {
  ...boxFallbacks,
  align: "left" as const,
  /** null means the document's text colour. */
  color: null,
  fontSize: 16,
  lineHeight: 1.5,
  fontWeight: "normal" as const,
  textTransform: "none" as const,
  letterSpacing: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderParagraph(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);

  const style = [
    `margin: 0`,
    `font-family: ${globals.fontFamily}`,
    `text-align: ${data.align || paragraphBlockFallbacks.align}`,
    `color: ${data.color || globals.textColor || "inherit"}`,
    `font-size: ${data.fontSize || paragraphBlockFallbacks.fontSize}px`,
    `line-height: ${data.lineHeight || paragraphBlockFallbacks.lineHeight}`,
    `font-weight: ${data.fontWeight || paragraphBlockFallbacks.fontWeight}`,
    `text-transform: ${data.textTransform || paragraphBlockFallbacks.textTransform}`,
    `letter-spacing: ${
      data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"
    }`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  let content = data.text;
  if (data.href) {
    content = `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }))}" target="_blank" style="color: inherit; text-decoration: none;">${content}</a>`;
  }

  return renderBox(`<p style="${escapeAttr(style)}">${content}</p>`, data);
}

function renderMJMLParagraph(block: any): string {
  const { data } = block;
  const box = renderMJMLBox(
    data.href
      ? `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }) || "#")}" style="color: inherit; text-decoration: none;">${data.text}</a>`
      : data.text,
    data,
  );

  return `
        <mj-text
          align="${data.align || "left"}"
          color="${data.color || "#000000"}"
          font-size="${data.fontSize || 16}px"
          line-height="${data.lineHeight || 1.5}"
          font-weight="${data.fontWeight || "normal"}"
          text-transform="${data.textTransform || "none"}"
          letter-spacing="${data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"}"
          padding="${box.padding}"
        >
          ${box.content}
        </mj-text>`;
}

export const paragraphBlock: BlockDefinition = {
  type: "paragraph",
  label: "Paragraph",
  fallbacks: paragraphBlockFallbacks,
  createDefaults: () => copy({
    text: "Your paragraph text here",
    align: "left" as const,
    padding: { top: 10, right: 0, bottom: 10, left: 0 },
  }),
  dataSchema: paragraphBlockDataSchema,
  renderHTML: renderParagraph,
  renderMJML: renderMJMLParagraph,
  describe: (block: any) => `Paragraph: ${String(block.data.text).slice(0, 20)}`,
};
