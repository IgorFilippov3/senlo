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
