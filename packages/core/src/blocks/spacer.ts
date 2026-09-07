// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr } from "../renderer/escape";
import { renderPadding } from "../renderer/utils";
import {
  contentConditionSchema,
  copy,
  paddingSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const spacerBlockDataSchema = z.object({
  height: z.number().nonnegative(),
  padding: paddingSchema.optional(),
});

export type SpacerBlockData = z.infer<
  typeof spacerBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const spacerBlockFormSchema = spacerBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const spacerBlockFallbacks = {
  height: 20,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderSpacer(block: any): string {
  const { data } = block;
  const height = data.height || spacerBlockFallbacks.height;
  const style = [
    `height: ${height}px`,
    `line-height: ${height}px`,
    `font-size: ${height}px`,
    `padding: ${renderPadding(data.padding)}`,
  ].join("; ");

  return `
    <div style="${escapeAttr(style)}">&nbsp;</div>
  `;
}

function renderMJMLSpacer(block: any): string {
  const { data } = block;
  return `
        <mj-spacer height="${data.height || 20}px" padding="${renderPadding(data.padding)}" />`;
}

export const spacerBlock: BlockDefinition = {
  type: "spacer",
  label: "Spacer",
  fallbacks: spacerBlockFallbacks,
  createDefaults: () => copy({
    height: 20,
  }),
  dataSchema: spacerBlockDataSchema,
  renderHTML: renderSpacer,
  renderMJML: renderMJMLSpacer,
  describe: (block: any) => `Spacer (${block.data.height}px)`,
};
