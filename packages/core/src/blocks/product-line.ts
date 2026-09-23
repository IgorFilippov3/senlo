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
  boxFallbacks,
  boxFields,
  contentConditionSchema,
  copy,
  paddingSchema,
  textStyleSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

/** One line of the list: a label on the left, its value on the right. */
export const productLineItemSchema = z.object({
  left: z.string(),
  right: z.string(),
});

export const productLineBlockDataSchema = z.object({
  items: z
    .array(productLineItemSchema)
    .min(1, "At least one line is required"),
  leftStyle: textStyleSchema.optional(),
  rightStyle: textStyleSchema.optional(),
  rightWidth: z.number().positive().optional(),
  /** Space inside each line, which is also what the rule between them clears. */
  rowPadding: paddingSchema.optional(),
  /** A rule between the lines. Absent means no rules at all. */
  divider: z
    .object({
      width: z.number().int().nonnegative().optional(),
      style: z.enum(["solid", "dashed", "dotted"]).optional(),
      color: z.string().optional(),
    })
    .optional(),
  padding: paddingSchema.optional(),
  ...boxFields,
});

export type ProductLineBlockData = z.infer<typeof productLineBlockDataSchema>;

/** Kept local: the document's own `ProductLineItem` is the exported name. */
type Item = z.infer<typeof productLineItemSchema>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const productLineBlockFormSchema = productLineBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const productLineBlockFallbacks = {
  ...boxFallbacks,
  rightWidth: 120,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  /**
   * Zero, so a block written before the list existed keeps the height it had.
   * A block created now gets a real value from `createDefaults`.
   */
  rowPadding: { top: 0, right: 0, bottom: 0, left: 0 },
  /** Zero width means no rule at all, which is what the panel starts from. */
  divider: { width: 0, style: "solid" as const, color: "#e5e7eb" },
  /** null for a colour means the document's text colour. */
  leftStyle: {
    fontSize: 14,
    lineHeight: 1.4,
    fontWeight: "normal" as const,
    color: null,
  },
  rightStyle: {
    fontSize: 14,
    lineHeight: 1.4,
    fontWeight: "normal" as const,
    color: null,
  },
};

/**
 * The block's lines.
 *
 * A document saved before this block became a list holds a single `leftText` /
 * `rightText` pair. Those documents are converted on the way in, by the
 * migration in `migrations.ts`; this only guards the rendering path against a
 * block that never went through it.
 */
export function productLineItems(data: any): Item[] {
  if (Array.isArray(data?.items)) return data.items;
  if (data?.leftText !== undefined || data?.rightText !== undefined) {
    return [{ left: data.leftText ?? "", right: data.rightText ?? "" }];
  }
  return [];
}

function renderProductLine(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  const leftStyle = data.leftStyle || {};
  const rightStyle = data.rightStyle || {};
  const items = productLineItems(data);

  const containerStyle = `padding: ${renderPadding(data.padding)}`;

  const tableStyle = [
    `width: 100%`,
    `border-collapse: collapse`,
    `border-spacing: 0`,
  ].join("; ");

  const rowPadding = renderPadding(
    data.rowPadding || productLineBlockFallbacks.rowPadding,
  );

  // The rule lives on the cells of the line above it rather than in a row of
  // its own: a border on a <td> is the one horizontal line every client draws,
  // Outlook included.
  const rule = (isLast: boolean) => {
    const divider = data.divider;
    if (!divider || isLast) return "";

    const width = Number(divider.width ?? 0);
    if (!width) return "";

    return `; border-bottom: ${width}px ${divider.style || "solid"} ${
      divider.color || "#e5e7eb"
    }`;
  };

  // A colour per column, because the two sides are styled separately. Each one
  // is written on its cell and on any link the author typed into that cell.
  const leftColor = leftStyle.color || globals.textColor || "#000000";
  const rightColor = rightStyle.color || globals.textColor || "#000000";

  const leftCellStyle = [
    `text-align: left`,
    `font-family: ${leftStyle.fontFamily || globals.fontFamily}`,
    `font-size: ${leftStyle.fontSize || productLineBlockFallbacks.leftStyle.fontSize}px`,
    `line-height: ${leftStyle.lineHeight || productLineBlockFallbacks.leftStyle.lineHeight}`,
    `color: ${leftColor}`,
    `font-weight: ${leftStyle.fontWeight || productLineBlockFallbacks.leftStyle.fontWeight}`,
    `vertical-align: top`,
    `padding: ${rowPadding}`,
  ].join("; ");

  const rightCellStyle = [
    `text-align: right`,
    `width: ${data.rightWidth || productLineBlockFallbacks.rightWidth}px`,
    `font-family: ${rightStyle.fontFamily || globals.fontFamily}`,
    `font-size: ${rightStyle.fontSize || productLineBlockFallbacks.rightStyle.fontSize}px`,
    `line-height: ${rightStyle.lineHeight || productLineBlockFallbacks.rightStyle.lineHeight}`,
    `color: ${rightColor}`,
    `font-weight: ${rightStyle.fontWeight || productLineBlockFallbacks.rightStyle.fontWeight}`,
    `white-space: nowrap`,
    `vertical-align: top`,
    `padding: ${rowPadding}`,
  ].join("; ");

  const rows = items
    .map((item, index) => {
      const isLast = index === items.length - 1;

      return `
          <tr>
            <td style="${escapeAttr(leftCellStyle + rule(isLast))}">
              ${colorInlineLinks(item.left, leftColor)}
            </td>
            <td style="${escapeAttr(rightCellStyle + rule(isLast))}">
              ${colorInlineLinks(item.right, rightColor)}
            </td>
          </tr>`;
    })
    .join("");

  return renderBox(
    `
    <div style="${escapeAttr(containerStyle)}">
      <table role="presentation" style="${escapeAttr(tableStyle)}">
        <tbody>${rows}
        </tbody>
      </table>
    </div>
  `,
    data,
  );
}

function renderMJMLProductLine(block: any): string {
  const { data } = block;
  const leftStyle = data.leftStyle || {};
  const rightStyle = data.rightStyle || {};
  const items = productLineItems(data);
  const rowPadding = renderPadding(
    data.rowPadding || productLineBlockFallbacks.rowPadding,
  );

  const rule = (isLast: boolean) => {
    const divider = data.divider;
    const width = Number(divider?.width ?? 0);
    if (!divider || isLast || !width) return "";

    return ` border-bottom: ${width}px ${divider.style || "solid"} ${divider.color || "#e5e7eb"};`;
  };

  const leftColor = leftStyle.color || "#000000";
  const rightColor = rightStyle.color || "#000000";

  const rows = items
    .map((item, index) => {
      const isLast = index === items.length - 1;

      return `
            <tr>
              <td align="left" style="font-family: ${leftStyle.fontFamily || "Arial, sans-serif"}; font-size: ${leftStyle.fontSize || 14}px; line-height: ${leftStyle.lineHeight || 1.4}; color: ${leftColor}; font-weight: ${leftStyle.fontWeight || "normal"}; padding: ${rowPadding};${rule(isLast)}">
                ${colorInlineLinks(item.left, leftColor)}
              </td>
              <td align="right" width="${data.rightWidth || 120}" style="width: ${data.rightWidth || 120}px; font-family: ${rightStyle.fontFamily || "Arial, sans-serif"}; font-size: ${rightStyle.fontSize || 14}px; line-height: ${rightStyle.lineHeight || 1.4}; color: ${rightColor}; font-weight: ${rightStyle.fontWeight || "normal"}; white-space: nowrap; padding: ${rowPadding};${rule(isLast)}">
                ${colorInlineLinks(item.right, rightColor)}
              </td>
            </tr>`;
    })
    .join("");

  const box = renderMJMLBox(
    `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%; border-collapse: collapse;">${rows}
          </table>`,
    data,
  );

  return `
        <mj-text padding="${box.padding}">
          ${box.content}
        </mj-text>`;
}

export const productLineBlock: BlockDefinition = {
  type: "product-line",
  label: "Product Line",
  fallbacks: productLineBlockFallbacks,
  createDefaults: () =>
    copy({
      items: [{ left: "Product name", right: "$99.99" }],
      leftStyle: {
        fontSize: 14,
        lineHeight: 1.4,
        fontWeight: "normal" as const,
        fontFamily: "Arial, sans-serif",
        color: "#000000",
      },
      rightStyle: {
        fontSize: 14,
        lineHeight: 1.4,
        fontWeight: "normal" as const,
        fontFamily: "Arial, sans-serif",
        color: "#000000",
      },
      rightWidth: 120,
      rowPadding: { top: 8, right: 0, bottom: 8, left: 0 },
      padding: { top: 10, right: 0, bottom: 10, left: 0 },
    }),
  dataSchema: productLineBlockDataSchema,
  renderHTML: renderProductLine,
  renderMJML: renderMJMLProductLine,
  describe: (block: any) => {
    const items = productLineItems(block.data);
    if (items.length === 1) {
      return `Product Line: ${items[0].left} - ${items[0].right}`;
    }
    return `Product Line: ${items.length} lines`;
  },
};
