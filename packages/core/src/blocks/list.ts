// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr } from "../renderer/escape";
import { globalsOf } from "../renderer/types";
import { renderPadding } from "../renderer/utils";
import type { RenderContext } from "../renderer/types";
import {
  alignSchema,
  contentConditionSchema,
  copy,
  paddingSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const listBlockDataSchema = z.object({
  items: z
    .array(z.string().min(1, "Item text is required"))
    .min(1, "At least one item is required"),
  listType: z.enum(["ordered", "unordered"]).optional(),
  align: alignSchema.optional(),
  color: z.string().optional(),
  fontSize: z.number().positive().optional(),
  lineHeight: z.number().positive().optional(),
  fontWeight: z.enum(["normal", "bold", "bolder"]).optional(),
  padding: paddingSchema.optional(),
});

export type ListBlockData = z.infer<
  typeof listBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const listBlockFormSchema = listBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const listBlockFallbacks = {
  listType: "unordered" as const,
  align: "left" as const,
  /** null means the document's text colour. */
  color: null,
  fontSize: 16,
  lineHeight: 1.5,
  fontWeight: "normal" as const,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderList(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  const Tag = data.listType === "ordered" ? "ol" : "ul";
  const listStyle = data.listType === "ordered" ? "decimal" : "disc";

  const style = [
    `margin: 0`,
    `font-family: ${globals.fontFamily}`,
    `text-align: ${data.align || listBlockFallbacks.align}`,
    `color: ${data.color || globals.textColor || "inherit"}`,
    `font-size: ${data.fontSize || listBlockFallbacks.fontSize}px`,
    `line-height: ${data.lineHeight || listBlockFallbacks.lineHeight}`,
    `font-weight: ${data.fontWeight || listBlockFallbacks.fontWeight}`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  const itemsHtml = (data.items || [])
    .map((item: string) => `<li style="margin-bottom: 4px;">${item}</li>`)
    .join("");

  return `
    <div style="${escapeAttr(style)}">
      <${Tag} style="margin: 0; padding-left: 24px; list-style-type: ${escapeAttr(listStyle)};">
        ${itemsHtml}
      </${Tag}>
    </div>
  `;
}

function renderMJMLList(block: any): string {
  const { data } = block;
  const Tag = data.listType === "ordered" ? "ol" : "ul";
  const listStyle = data.listType === "ordered" ? "decimal" : "disc";
  const itemsHtml = (data.items || [])
    .map((item: string) => `<li>${item}</li>`)
    .join("");

  return `
        <mj-text
          align="${data.align || "left"}"
          color="${data.color || "#000000"}"
          font-size="${data.fontSize || 16}px"
          line-height="${data.lineHeight || 1.5}"
          font-weight="${data.fontWeight || "normal"}"
          padding="${renderPadding(data.padding)}"
        >
          <${Tag} style="margin: 0; padding-left: 20px; list-style-type: ${listStyle};">
            ${itemsHtml}
          </${Tag}>
        </mj-text>`;
}

export const listBlock: BlockDefinition = {
  type: "list",
  label: "List",
  fallbacks: listBlockFallbacks,
  createDefaults: () => copy({
    items: ["List item 1", "List item 2", "List item 3"],
    listType: "unordered" as const,
    fontSize: 16,
    lineHeight: 1.5,
    fontWeight: "normal" as const,
    align: "left" as const,
    padding: { top: 10, right: 0, bottom: 10, left: 24 },
  }),
  dataSchema: listBlockDataSchema,
  renderHTML: renderList,
  renderMJML: renderMJMLList,
  describe: (block: any) => `List (${block.data.items.length} items)`,
};
