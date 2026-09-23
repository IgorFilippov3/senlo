// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr } from "../renderer/escape";
import { globalsOf } from "../renderer/types";
import {
  colorInlineLinks,
  renderBox,
  renderMJMLBox,
  renderPadding,
} from "../renderer/utils";
import type { RenderContext } from "../renderer/types";
import {
  alignSchema,
  boxFallbacks,
  boxFields,
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
  fontWeight: z.enum(["normal", "bold"]).optional(),
  padding: paddingSchema.optional(),
  ...boxFields,
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
  ...boxFallbacks,
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

  // Resolved once: the list writes it on itself, and any link the author typed
  // inside an item gets the same value, so the two cannot drift.
  const color = data.color || globals.textColor || "inherit";

  const style = [
    `margin: 0`,
    `font-family: ${globals.fontFamily}`,
    `text-align: ${data.align || listBlockFallbacks.align}`,
    `color: ${color}`,
    `font-size: ${data.fontSize || listBlockFallbacks.fontSize}px`,
    `line-height: ${data.lineHeight || listBlockFallbacks.lineHeight}`,
    `font-weight: ${data.fontWeight || listBlockFallbacks.fontWeight}`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  const itemsHtml = (data.items || [])
    .map(
      (item: string) =>
        `<li style="margin-bottom: 4px;">${colorInlineLinks(item, color)}</li>`,
    )
    .join("");

  return renderBox(
    `
    <div style="${escapeAttr(style)}">
      <${Tag} style="margin: 0; padding-left: 24px; list-style-type: ${escapeAttr(listStyle)};">
        ${itemsHtml}
      </${Tag}>
    </div>
  `,
    data,
  );
}

function renderMJMLList(block: any): string {
  const { data } = block;
  const Tag = data.listType === "ordered" ? "ol" : "ul";
  const listStyle = data.listType === "ordered" ? "decimal" : "disc";
  const color = data.color || "#000000";
  const itemsHtml = (data.items || [])
    .map((item: string) => `<li>${colorInlineLinks(item, color)}</li>`)
    .join("");
  const box = renderMJMLBox(
    `<${Tag} style="margin: 0; padding-left: 20px; list-style-type: ${listStyle};">
            ${itemsHtml}
          </${Tag}>`,
    data,
  );

  return `
        <mj-text
          align="${data.align || "left"}"
          color="${color}"
          font-size="${data.fontSize || 16}px"
          line-height="${data.lineHeight || 1.5}"
          font-weight="${data.fontWeight || "normal"}"
          padding="${box.padding}"
        >
          ${box.content}
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
