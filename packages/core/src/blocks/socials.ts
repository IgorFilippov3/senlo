// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr, sanitizeUrl } from "../renderer/escape";
import { normalizeUrl, renderPadding } from "../renderer/utils";
import type { RenderContext, RenderOptions } from "../renderer/types";
import {
  alignSchema,
  contentConditionSchema,
  copy,
  paddingSchema,
  socialLinkSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const socialsBlockDataSchema = z.object({
  links: z
    .array(socialLinkSchema)
    .min(1, "At least one social link is required"),
  align: alignSchema.optional(),
  size: z.number().positive().optional(),
  spacing: z.number().nonnegative().optional(),
  padding: paddingSchema.optional(),
});

export type SocialsBlockData = z.infer<
  typeof socialsBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const socialsBlockFormSchema = socialsBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const socialsBlockFallbacks = {
  align: "center" as const,
  size: 32,
  spacing: 10,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

function renderSocials(block: any, context: RenderContext): string {
  const { data } = block;
  const iconSize = Number(data.size) || socialsBlockFallbacks.size;
  const spacing = Number(data.spacing) || socialsBlockFallbacks.spacing;
  const padding = renderPadding(data.padding);

  const containerStyle = [
    `padding: ${padding}`,
    `text-align: ${data.align || socialsBlockFallbacks.align}`,
  ].join("; ");

  const linksHtml = (data.links || [])
    .map((link: any) => {
      const iconSrc = escapeAttr(
        sanitizeUrl(normalizeUrl(link.icon, context.options?.baseUrl), {
          allowDataImage: true,
        }),
      );
      const imgHtml = `<img src="${iconSrc}" alt="${escapeAttr(link.type)}" width="${iconSize}" height="${iconSize}" style="display: inline-block; border-radius: 4px;" />`;
      if (link.url) {
        return `<a href="${escapeAttr(sanitizeUrl(link.url, { fallback: "#" }))}" target="_blank" style="text-decoration: none; margin: 0 ${spacing / 2}px; display: inline-block;">${imgHtml}</a>`;
      }
      return `<span style="margin: 0 ${spacing / 2}px; display: inline-block;">${imgHtml}</span>`;
    })
    .join("");

  return `<div style="${escapeAttr(containerStyle)}">${linksHtml}</div>`;
}

function renderMJMLSocials(block: any, options?: RenderOptions): string {
  const { data } = block;
  const iconSize = data.size || 32;
  const spacing = data.spacing || 10;
  const padding = renderPadding(data.padding);

  const elements = (data.links || []).map((link: any) => {
    const iconSrc = escapeAttr(
      sanitizeUrl(normalizeUrl(link.icon, options?.baseUrl), {
        allowDataImage: true,
      }),
    );
    return `<mj-social-element name="${escapeAttr(link.type)}-noshare" src="${iconSrc}" href="${escapeAttr(sanitizeUrl(link.url, { fallback: "#" }) || "#")}" />`;
  });

  return `
        <mj-social 
          align="${data.align || "center"}" 
          font-size="12px" 
          icon-size="${iconSize}px" 
          mode="horizontal" 
          padding="${padding}"
          inner-padding="${spacing / 2}px"
        >
          ${elements.join("\n          ")}
        </mj-social>`;
}

export const socialsBlock: BlockDefinition = {
  type: "socials",
  label: "Socials",
  fallbacks: socialsBlockFallbacks,
  createDefaults: () => copy({
    links: [
      { type: "facebook" as const, url: "", icon: "/facebook.png" },
      { type: "twitter" as const, url: "", icon: "/twitter.png" },
      { type: "instagram" as const, url: "", icon: "/instagram.png" },
    ],
    align: "center" as const,
    size: 32,
    spacing: 10,
    padding: { top: 10, right: 0, bottom: 10, left: 0 },
  }),
  dataSchema: socialsBlockDataSchema,
  renderHTML: renderSocials,
  renderMJML: renderMJMLSocials,
  describe: (block: any) => `Socials (${block.data.links.length})`,
};
