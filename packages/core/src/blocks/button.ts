// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { escapeAttr, sanitizeUrl } from "../renderer/escape";
import { stripTags } from "../renderer/htmlToText";
import { globalsOf } from "../renderer/types";
import { borderDeclarations, cell, renderPadding } from "../renderer/utils";
import type { RenderContext } from "../renderer/types";
import {
  alignSchema,
  borderSchema,
  contentConditionSchema,
  copy,
  paddingSchema,
  shadowSchema,
  urlLikeSchema,
} from "./shared";
import type { BlockDefinition } from "./types";

export const buttonBlockDataSchema = z.object({
  text: z.string().min(1, "Button text is required"),
  href: urlLikeSchema,
  align: alignSchema.optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  borderRadius: z.number().nonnegative().optional(),
  padding: paddingSchema.optional(),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional(),
  textTransform: z.enum(["none", "uppercase"]).optional(),
  letterSpacing: z.number().optional(),
  fullWidth: z.boolean().optional(),
  /**
   * The gap around the button. Not part of `boxFields` like the text blocks'
   * margin, because the other three fields that spread carries -
   * `backgroundColor`, `border`, `borderRadius` - already exist here and mean
   * the button itself rather than a card around it.
   */
  margin: paddingSchema.optional(),
});

export type ButtonBlockData = z.infer<
  typeof buttonBlockDataSchema
>;

/**
 * What the property panel validates: the block's data plus the condition the
 * form edits next to it. Declared here rather than derived generically so the
 * field types survive for `formState.errors`.
 */
export const buttonBlockFormSchema = buttonBlockDataSchema.extend({
  condition: contentConditionSchema.optional(),
});

export const buttonBlockFallbacks = {
  align: "center" as const,
  backgroundColor: "#3b82f6",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: "bold" as const,
  textTransform: "none" as const,
  letterSpacing: 0,
  borderRadius: 4,
  padding: { top: 12, right: 24, bottom: 12, left: 24 },
  border: { width: 0, style: "solid" as const, color: "#000000" },
  /**
   * Not zero, unlike the text blocks': this is the gap the button's wrapper
   * used to hardcode, so a button nobody has touched renders exactly as it
   * always did and the panel shows the value it actually has.
   */
  margin: { top: 10, right: 0, bottom: 10, left: 0 },
};

function renderButton(block: any, context: RenderContext): string {
  const { data } = block;
  const globals = globalsOf(context);

  const rawPadding = data.padding || buttonBlockFallbacks.padding;
  const padding = {
    top: Number(rawPadding.top) || 0,
    right: Number(rawPadding.right) || 0,
    bottom: Number(rawPadding.bottom) || 0,
    left: Number(rawPadding.left) || 0,
  };
  const border = data.border || buttonBlockFallbacks.border;

  const styles = [
    `background-color: ${data.backgroundColor || buttonBlockFallbacks.backgroundColor}`,
    `color: ${data.color || buttonBlockFallbacks.color}`,
    `font-family: ${globals.fontFamily}`,
    `display: ${data.fullWidth ? "block" : "inline-block"}`,
    `padding: ${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    `text-decoration: none`,
    `border-radius: ${data.borderRadius || buttonBlockFallbacks.borderRadius}px`,
    `font-size: ${data.fontSize || buttonBlockFallbacks.fontSize}px`,
    `font-weight: ${data.fontWeight || buttonBlockFallbacks.fontWeight}`,
    `text-transform: ${data.textTransform || buttonBlockFallbacks.textTransform}`,
    `letter-spacing: ${
      data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"
    }`,
    `text-align: center`,
  ];

  styles.push(...borderDeclarations(border));

  // Handle shadow with fallback for hard shadows (blur: 0)
  if (data.shadow) {
    const { x = 0, y = 0, blur = 0, color = "#000000" } = data.shadow;

    // Add box-shadow for modern clients
    styles.push(`box-shadow: ${x}px ${y}px ${blur}px ${color}`);

    // Fallback for hard shadows (often used in Brutalism style)
    if (blur === 0 && (x !== 0 || y !== 0)) {
      if (y > 0) styles.push(`border-bottom: ${y}px solid ${color}`);
      if (x > 0) styles.push(`border-right: ${x}px solid ${color}`);
      if (y < 0) styles.push(`border-top: ${Math.abs(y)}px solid ${color}`);
      if (x < 0) styles.push(`border-left: ${Math.abs(x)}px solid ${color}`);
    }
  }

  const href = escapeAttr(sanitizeUrl(data.href, { fallback: "#" }) || "#");
  const anchor = `<a href="${href}" target="_blank" style="${escapeAttr(styles.join("; "))}">${data.text}</a>`;

  const inner = `
    <div style="text-align: ${escapeAttr(data.align || buttonBlockFallbacks.align)};">
      ${renderButtonVml(data, border, padding, href, globals.fontFamily)}
      <!--[if !mso]><!-->
      ${anchor}
      <!--<![endif]-->
    </div>
  `;

  // The gap around the button. It used to be `padding: 10px 0` written into the
  // wrapper div above, which meant no author could change it - not even to
  // zero - and that a horizontal gap was not expressible at all. A <td> is the
  // one element every client, Outlook included, pads correctly, so the gap goes
  // on a cell here exactly as it does for a row and for a text block's margin;
  // a div would drop the left and right sides in Outlook's Word engine.
  //
  // The fallback is the 10px the div used to carry, so a button saved before
  // this field existed sits in the same space it always did.
  const margin = data.margin || buttonBlockFallbacks.margin;

  return cell(`padding: ${renderPadding(margin)}`, inner);
}

function renderButtonVml(
  data: any,
  border: any,
  padding: { top: number; right: number; bottom: number; left: number },
  href: string,
  fontFamily: string,
): string {
  const label = stripTags(data.text) || "";
  const fontSize = Number(data.fontSize) || 16;
  const borderWidth = Number(border.width) || 0;

  const height = Math.round(
    fontSize * 1.5 + padding.top + padding.bottom + borderWidth * 2,
  );
  // Rough average character width for the web-safe families in the picker.
  const width = Math.round(
    label.length * fontSize * 0.6 + padding.left + padding.right,
  );
  const radius = Number(data.borderRadius ?? 4);
  const arcsize = Math.min(50, Math.round((radius / Math.max(height, 1)) * 100));

  const sizeStyle = data.fullWidth
    ? "mso-width-percent: 1000;"
    : `width: ${Math.max(width, 1)}px;`;

  const stroke =
    borderWidth > 0
      ? `stroke="t" strokecolor="${escapeAttr(border.color || "#000000")}" strokeweight="${borderWidth}px"`
      : 'stroke="f"';

  const centerStyle = [
    `color: ${data.color || "#ffffff"}`,
    `font-family: ${fontFamily}`,
    `font-size: ${fontSize}px`,
    `font-weight: ${data.fontWeight || "bold"}`,
    `text-transform: ${data.textTransform || "none"}`,
  ].join("; ");

  return `<!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height: ${height}px; v-text-anchor: middle; ${sizeStyle}" arcsize="${arcsize}%" ${stroke} fillcolor="${escapeAttr(data.backgroundColor || "#3b82f6")}">
        <w:anchorlock/>
        <center style="${escapeAttr(centerStyle)}">${escapeAttr(label)}</center>
      </v:roundrect>
      <![endif]-->`;
}

function renderMJMLButton(block: any): string {
  const { data } = block;
  const padding = data.padding || { top: 12, right: 24, bottom: 12, left: 24 };
  const border = data.border || { width: 0, style: "solid", color: "#000000" };

  const borderAttrs = [];
  if (border.width !== undefined && border.width > 0) {
    borderAttrs.push(
      `border="${border.width}px ${border.style || "solid"} ${border.color || "#000000"}"`,
    );
  } else {
    if (border.top)
      borderAttrs.push(
        `border-top="${border.top}px ${border.style || "solid"} ${border.color || "#000000"}"`,
      );
    if (border.right)
      borderAttrs.push(
        `border-right="${border.right}px ${border.style || "solid"} ${border.color || "#000000"}"`,
      );
    if (border.bottom)
      borderAttrs.push(
        `border-bottom="${border.bottom}px ${border.style || "solid"} ${border.color || "#000000"}"`,
      );
    if (border.left)
      borderAttrs.push(
        `border-left="${border.left}px ${border.style || "solid"} ${border.color || "#000000"}"`,
      );
  }

  // Handle hard shadow fallback in MJML
  if (data.shadow && data.shadow.blur === 0) {
    const { x = 0, y = 0, color = "#000000" } = data.shadow;
    if (y > 0) borderAttrs.push(`border-bottom="${y}px solid ${color}"`);
    if (x > 0) borderAttrs.push(`border-right="${x}px solid ${color}"`);
    if (y < 0) borderAttrs.push(`border-top="${Math.abs(y)}px solid ${color}"`);
    if (x < 0)
      borderAttrs.push(`border-left="${Math.abs(x)}px solid ${color}"`);
  }

  return `
        <mj-button
          background-color="${data.backgroundColor || "#3b82f6"}"
          color="${data.color || "#ffffff"}"
          align="${data.align || "center"}"
          font-size="${data.fontSize || 16}px"
          font-weight="${data.fontWeight || "bold"}"
          border-radius="${data.borderRadius || 4}px"
          ${borderAttrs.join("\n          ")}
          padding="${renderPadding(data.margin || buttonBlockFallbacks.margin)}"
          inner-padding="${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px"
          text-transform="${data.textTransform || "none"}"
          letter-spacing="${data.letterSpacing !== undefined ? data.letterSpacing + "px" : "normal"}"
          ${data.fullWidth ? 'width="100%"' : ""}
          ${data.href ? `href="${escapeAttr(sanitizeUrl(data.href, { fallback: "#" }) || "#")}"` : ""}
        >
          ${data.text}
        </mj-button>`;
}

export const buttonBlock: BlockDefinition = {
  type: "button",
  label: "Button",
  fallbacks: buttonBlockFallbacks,
  createDefaults: () => copy({
    text: "Button",
    href: "",
    align: "center" as const,
  }),
  dataSchema: buttonBlockDataSchema,
  renderHTML: renderButton,
  renderMJML: renderMJMLButton,
  describe: (block: any) => `Button: ${block.data.text}`,
};
