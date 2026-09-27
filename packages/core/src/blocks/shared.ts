// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";

export const paddingSchema = z.object({
  top: z.number().int().nonnegative().optional(),
  right: z.number().int().nonnegative().optional(),
  bottom: z.number().int().nonnegative().optional(),
  left: z.number().int().nonnegative().optional(),
});

export const borderSchema = z.object({
  width: z.number().int().nonnegative().optional(),
  top: z.number().int().nonnegative().optional(),
  right: z.number().int().nonnegative().optional(),
  bottom: z.number().int().nonnegative().optional(),
  left: z.number().int().nonnegative().optional(),
  style: z.enum(["solid", "dashed", "dotted"]).optional(),
  color: z.string().optional(),
});

/**
 * The four corners of a rounded box, named in the order CSS writes them.
 *
 * The order is not cosmetic: `formatCornerRadius` is a join over these fields,
 * so a field list in reading order (top-left, top-right, bottom-left,
 * bottom-right) would need a reorder at every call site, and a missed reorder
 * is invisible in any preview where the corners happen to be equal.
 *
 * A block may still store a single number instead - that is what every
 * document written before this shape existed carries, and what the AI endpoint
 * and the public API can still send. `resolveCornerRadius` is the one place
 * that difference is resolved.
 */
export const cornerRadiusSchema = z.object({
  topLeft: z.number().int().nonnegative().optional(),
  topRight: z.number().int().nonnegative().optional(),
  bottomRight: z.number().int().nonnegative().optional(),
  bottomLeft: z.number().int().nonnegative().optional(),
});

export type CornerRadius = z.infer<typeof cornerRadiusSchema>;

/** What a block's radius can be on the way in: the old number or the new corners. */
export const cornerRadiusValueSchema = z.union([
  z.number().nonnegative(),
  cornerRadiusSchema,
]);

export const ZERO_CORNER_RADIUS: Required<CornerRadius> = {
  topLeft: 0,
  topRight: 0,
  bottomRight: 0,
  bottomLeft: 0,
};

/**
 * Card-like styling a content block can carry: a background, a border, rounded
 * corners and a gap from its neighbours.
 *
 * These are spread into a block's own schema rather than nested under a key, so
 * the property panel edits them as plain fields and documents saved before they
 * existed stay valid. `margin` is the gap outside the background; the block's
 * own `padding` is what sits inside it.
 */
export const boxFields = {
  backgroundColor: z.string().optional(),
  border: borderSchema.optional(),
  borderRadius: z.number().int().nonnegative().optional(),
  margin: paddingSchema.optional(),
};

/**
 * What the property panel shows for a block that has no box styling of its
 * own - which is every block until an author gives it some.
 */
export const boxFallbacks = {
  /** null means no background at all, not a white one. */
  backgroundColor: null,
  border: { width: 0, style: "solid" as const, color: "#e5e7eb" },
  borderRadius: 0,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
};

/**
 * A colour the renderer is willing to write into a CSS declaration.
 *
 * Not a free string. Everything a block stores ends up inside a `style`
 * attribute, and `escapeAttr` - which is what every style string goes through -
 * does not touch `;`, so an unvalidated colour is a way to append declarations
 * of one's own. A document does not have to come from the editor to get here:
 * the AI endpoint and the public API both build one from outside.
 *
 * Three shapes, each pinned end to end:
 *   #rgb / #rgba / #rrggbb / #rrggbbaa
 *   rgb(…) / rgba(…) with numeric or percentage channels
 *   a bare word - `white`, `transparent`. Not checked against the CSS list:
 *   letters alone cannot carry a declaration separator, and a misspelt colour
 *   is the author's problem rather than anyone's exposure.
 */
export const cssColorSchema = z
  .string()
  .trim()
  .regex(
    /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*(?:,\s*(?:0|1|0?\.\d{1,3})\s*)?\)|[a-zA-Z]{3,20})$/,
    "Must be a hex colour, an rgb()/rgba() colour, or a colour name",
  );

/**
 * A two-stop linear gradient painted over a background colour.
 *
 * Two stops rather than a list: a stop editor is a component larger than the
 * feature it serves, the email cases that need one round to zero, and two is
 * also all a VML fallback could ever express if Outlook is ever revisited.
 *
 * `angle` is CSS degrees, where 180 runs top to bottom.
 */
export const linearGradientSchema = z.object({
  from: cssColorSchema,
  to: cssColorSchema,
  angle: z.number().int().min(0).max(360).optional(),
});

export type LinearGradient = z.infer<typeof linearGradientSchema>;

/**
 * A rule above or below a row.
 *
 * Deliberately not `borderSchema`, which the blocks use: that one carries
 * `width`, `left` and `right` as well, and a row renders none of them. A schema
 * that permits what nothing draws is how a field ends up half-working - a
 * document could ask for a left border and never be told it was dropped. This
 * one describes exactly what is drawn, and widening it later is a small,
 * deliberate change.
 *
 * A row's rule exists because a block's cannot always be used: four cells each
 * drawing their own `border-bottom` make one line until one of them also has a
 * horizontal outer gap, at which point the line breaks into four inset
 * segments. A rule that belongs to the row is drawn once and no per-cell
 * setting can cut it.
 */
export const rowBorderSchema = z.object({
  top: z.number().int().nonnegative().optional(),
  bottom: z.number().int().nonnegative().optional(),
  style: z.enum(["solid", "dashed", "dotted"]).optional(),
  color: cssColorSchema.optional(),
});

export type RowBorder = z.infer<typeof rowBorderSchema>;

export const shadowSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  blur: z.number().optional(),
  color: z.string().optional(),
});

export const textStyleSchema = z.object({
  color: z.string().optional(),
  fontSize: z.number().positive().optional(),
  lineHeight: z.number().positive().optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  fontFamily: z.string().optional(),
});

export const alignSchema = z.enum(["left", "center", "right"]);

export const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "gt",
  "lt",
  "is_set",
  "is_not_set",
]);

export const contentConditionSchema = z.object({
  variable: z.string(),
  operator: conditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const socialLinkSchema = z.object({
  type: z.enum([
    "facebook",
    "twitter",
    "instagram",
    "youtube",
    "discord",
    "github",
    "reddit",
  ]),
  url: z.string(),
  icon: z.string(),
});

/**
 * A link or asset reference as this product actually uses them. The editor
 * used to require `z.string().url()` here, which rejected three things it is
 * supposed to support: the `/uploads/...` paths the upload endpoint returns,
 * merge tags such as `{{contact.profile_url}}`, and `mailto:` links.
 */
export const urlLikeSchema = z
  .string()
  .refine(
    (value) =>
      value === "" ||
      value.startsWith("/") ||
      value.startsWith("#") ||
      value.includes("{{") ||
      /^(?:https?|mailto|tel):/i.test(value),
    { message: "Must be a URL, a path starting with /, or a merge tag" },
  );

/** Padding shared by the blocks that had identical values. */
export const DEFAULT_TEXT_PADDING = { top: 10, right: 0, bottom: 10, left: 0 };

/** Fresh copy of a default object, so callers never share a reference. */
export function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
