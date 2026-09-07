// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr } from "../renderer/escape";
import { globalsOf } from "../renderer/types";
import { renderPadding } from "../renderer/utils";
import type { RenderContext } from "../renderer/types";
import {
  contentConditionSchema,
  copy,
  paddingSchema,
  textStyleSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const productLineBlockDataSchema = z.object({
  leftText: z.string().min(1, "Left text is required"),
  rightText: z.string().min(1, "Right text is required"),
  leftStyle: textStyleSchema.optional(),
  rightStyle: textStyleSchema.optional(),
  rightWidth: z.number().positive().optional(),
  padding: paddingSchema.optional(),
});

export type ProductLineBlockData = z.infer<
  typeof productLineBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const productLineBlockFormSchema = productLineBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

function renderProductLine(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);
  const leftStyle = data.leftStyle || {};
  const rightStyle = data.rightStyle || {};

  const containerStyle = [`padding: ${renderPadding(data.padding)}`].join("; ");

  const tableStyle = [
    `width: 100%`,
    `border-collapse: collapse`,
    `border-spacing: 0`,
  ].join("; ");

  const leftCellStyle = [
    `text-align: left`,
    `font-family: ${leftStyle.fontFamily || globals.fontFamily}`,
    `font-size: ${leftStyle.fontSize || 14}px`,
    `line-height: ${leftStyle.lineHeight || 1.4}`,
    `color: ${leftStyle.color || globals.textColor || "#000000"}`,
    `font-weight: ${leftStyle.fontWeight || "normal"}`,
    `vertical-align: top`,
    `padding: 0`,
  ].join("; ");

  const rightCellStyle = [
    `text-align: right`,
    `width: ${data.rightWidth || 120}px`,
    `font-family: ${rightStyle.fontFamily || globals.fontFamily}`,
    `font-size: ${rightStyle.fontSize || 14}px`,
    `line-height: ${rightStyle.lineHeight || 1.4}`,
    `color: ${rightStyle.color || globals.textColor || "#000000"}`,
    `font-weight: ${rightStyle.fontWeight || "normal"}`,
    `white-space: nowrap`,
    `vertical-align: top`,
    `padding: 0`,
  ].join("; ");

  return `
    <div style="${escapeAttr(containerStyle)}">
      <table role="presentation" style="${escapeAttr(tableStyle)}">
        <tbody>
          <tr>
            <td style="${escapeAttr(leftCellStyle)}">
              ${data.leftText || ""}
            </td>
            <td style="${escapeAttr(rightCellStyle)}">
              ${data.rightText || ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderMJMLProductLine(block: any): string {
  const { data } = block;
  const leftStyle = data.leftStyle || {};
  const rightStyle = data.rightStyle || {};

  return `
        <mj-text padding="${renderPadding(data.padding)}">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;">
            <tr>
              <td align="left" style="font-family: ${leftStyle.fontFamily || "Arial, sans-serif"}; font-size: ${leftStyle.fontSize || 14}px; line-height: ${leftStyle.lineHeight || 1.4}; color: ${leftStyle.color || "#000000"}; font-weight: ${leftStyle.fontWeight || "normal"};">
                ${data.leftText}
              </td>
              <td align="right" width="${data.rightWidth || 120}" style="width: ${data.rightWidth || 120}px; font-family: ${rightStyle.fontFamily || "Arial, sans-serif"}; font-size: ${rightStyle.fontSize || 14}px; line-height: ${rightStyle.lineHeight || 1.4}; color: ${rightStyle.color || "#000000"}; font-weight: ${rightStyle.fontWeight || "normal"}; white-space: nowrap;">
                ${data.rightText}
              </td>
            </tr>
          </table>
        </mj-text>`;
}

export const productLineBlock: BlockDefinition = {
  type: "product-line",
  label: "Product Line",
  createDefaults: () => copy({
    leftText: "Product name",
    rightText: "$99.99",
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
    padding: { top: 10, right: 0, bottom: 10, left: 0 },
  }),
  dataSchema: productLineBlockDataSchema,
  renderHTML: renderProductLine,
  renderMJML: renderMJMLProductLine,
  describe: (block: any) => `Product Line: ${block.data.leftText} - ${block.data.rightText}`,
};
