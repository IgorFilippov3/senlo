// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr, sanitizeUrl } from "../renderer/escape";
import { normalizeUrl, renderPadding } from "../renderer/utils";
import type { RenderContext, RenderOptions } from "../renderer/types";
import {
  alignSchema,
  borderSchema,
  contentConditionSchema,
  copy,
  paddingSchema,
  urlLikeSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const imageBlockDataSchema = z.object({
  src: urlLikeSchema,
  alt: z.string().optional(),
  href: urlLikeSchema.optional(),
  width: z.number().nonnegative().optional(),
  align: alignSchema.optional(),
  borderRadius: z.number().nonnegative().optional(),
  padding: paddingSchema.optional(),
  border: borderSchema.optional(),
  fullWidth: z.boolean().optional(),
});

export type ImageBlockData = z.infer<
  typeof imageBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const imageBlockFormSchema = imageBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

function renderImage(block: any, context: RenderContext): string {
  const { data } = block;

  const imgStyle = [
    `display: inline-block`,
    `outline: none`,
    `text-decoration: none`,
    `-ms-interpolation-mode: bicubic`,
    `width: ${
      data.fullWidth ? "100%" : data.width ? data.width + "px" : "auto"
    }`,
    `max-width: 100%`,
    `height: auto`,
    `border-radius: ${data.borderRadius || 0}px`,
    `border: ${
      data.border?.width
        ? `${data.border.width}px ${data.border.style} ${data.border.color}`
        : "0"
    }`,
    `vertical-align: middle`,
  ].join("; ");

  const containerStyle = [
    `text-align: ${data.align || "center"}`,
    `padding: ${renderPadding(data.padding)}`,
    `font-size: 0px`, // To remove line-height gaps around inline-block image
    `line-height: 0px`,
  ].join("; ");

  const src = escapeAttr(
    sanitizeUrl(normalizeUrl(data.src, context.options?.baseUrl), {
      allowDataImage: true,
    }),
  );
  const widthAttr = Number(data.width) ? ` width="${Number(data.width)}"` : "";
  let html = `<img src="${src}" alt="${escapeAttr(data.alt || "")}"${widthAttr} style="${escapeAttr(imgStyle)}" />`;

  if (data.href) {
    html = `<a href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }))}" target="_blank" style="text-decoration: none; display: inline-block;">${html}</a>`;
  }

  return `<div style="${escapeAttr(containerStyle)}">${html}</div>`;
}

function renderMJMLImage(block: any, options?: RenderOptions): string {
  const { data } = block;
  const src = escapeAttr(
    sanitizeUrl(normalizeUrl(data.src, options?.baseUrl), {
      allowDataImage: true,
    }),
  );
  return `
        <mj-image
          src="${src}"
          alt="${data.alt || ""}"
          width="${data.fullWidth ? "" : data.width ? data.width + "px" : ""}"
          fluid-on-mobile="${data.fullWidth ? "true" : "false"}"
          align="${data.align || "center"}"
          border-radius="${data.borderRadius || 0}px"
          border="${data.border?.width ? `${data.border.width}px ${data.border.style} ${data.border.color}` : "none"}"
          padding="${renderPadding(data.padding)}"
          ${data.href ? `href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }) || "#")}"` : ""}
        />`;
}

export const imageBlock: BlockDefinition = {
  type: "image",
  label: "Image",
  createDefaults: () => copy({
    src: "",
    alt: "Image",
    align: "center" as const,
    width: 300,
  }),
  dataSchema: imageBlockDataSchema,
  renderHTML: renderImage,
  renderMJML: renderMJMLImage,
  describe: (block: any) => "Image",
};
