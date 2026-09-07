// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr } from "../renderer/escape";
import { renderPadding } from "../renderer/utils";
import {
  alignSchema,
  contentConditionSchema,
  copy,
  paddingSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const dividerBlockDataSchema = z.object({
  color: z.string().optional(),
  width: z.number().min(1).max(100).optional(),
  align: alignSchema.optional(),
  borderWidth: z.number().nonnegative().optional(),
  borderStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  padding: paddingSchema.optional(),
});

export type DividerBlockData = z.infer<
  typeof dividerBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const dividerBlockFormSchema = dividerBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

function renderDivider(block: any): string {
  const { data } = block;
  const style = [
    `padding: ${renderPadding(data.padding)}`,
    `text-align: ${data.align || "center"}`,
    `font-size: 0px`,
    `line-height: 0px`,
  ].join("; ");

  const hrStyle = [
    `display: inline-block`,
    `width: ${data.width || 100}%`,
    `border-top: ${data.borderWidth || 1}px ${data.borderStyle || "solid"} ${
      data.color || "#cccccc"
    }`,
    `margin: 0`,
  ].join("; ");

  return `
    <div style="${escapeAttr(style)}">
      <div style="${escapeAttr(hrStyle)}">&nbsp;</div>
    </div>
  `;
}

function renderMJMLDivider(block: any): string {
  const { data } = block;
  return `
        <mj-divider
          border-width="${data.borderWidth || 1}px"
          border-style="${data.borderStyle || "solid"}"
          border-color="${data.color || "#cccccc"}"
          width="${data.width || 100}%"
          align="${data.align || "center"}"
          padding="${renderPadding(data.padding)}"
        />`;
}

export const dividerBlock: BlockDefinition = {
  type: "divider",
  label: "Divider",
  createDefaults: () => copy({
    color: "#cccccc",
    width: 100,
    align: "center" as const,
    borderWidth: 1,
    borderStyle: "solid" as const,
    padding: { top: 10, right: 0, bottom: 10, left: 0 },
  }),
  dataSchema: dividerBlockDataSchema,
  renderHTML: renderDivider,
  renderMJML: renderMJMLDivider,
  describe: (block: any) => "Divider",
};
