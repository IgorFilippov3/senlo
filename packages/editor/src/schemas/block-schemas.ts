import { z } from "zod";

export const paddingSchema = z.object({
  top: z.number().int().nonnegative().optional(),
  right: z.number().int().nonnegative().optional(),
  bottom: z.number().int().nonnegative().optional(),
  left: z.number().int().nonnegative().optional(),
});

export const conditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "gt",
  "lt",
  "is_set",
  "is_not_set",
]);

export const contentConditionSchema = z.object({
  variable: z.string().min(1, "Variable is required"),
  operator: conditionOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const headingSchema = z.object({
  text: z.string().min(1, "Text is required"),
  level: z.number().min(1).max(3),
  align: z.enum(["left", "center", "right"]),
  color: z.string().optional(),
  fontSize: z.number().min(8).max(128).optional(),
  lineHeight: z.number().min(0.5).max(3).step(0.1).optional(),
  fontWeight: z.enum(["normal", "bold", "bolder"]).optional(),
  href: z
    .string()
    .url("Must be a valid URL")
    .or(z.string().length(0))
    .optional(),
  textTransform: z.enum(["none", "uppercase"]).optional(),
  letterSpacing: z.number().min(-5).max(50).optional(),
  padding: paddingSchema.optional(),
  condition: contentConditionSchema.optional(),
});

export const paragraphSchema = z.object({
  text: z.string().min(1, "Text is required"),
  align: z.enum(["left", "center", "right"]),
  color: z.string().optional(),
  fontSize: z.number().min(8).max(128).optional(),
  lineHeight: z.number().min(0.5).max(3).step(0.1).optional(),
  fontWeight: z.enum(["normal", "bold", "bolder"]).optional(),
  href: z
    .string()
    .url("Must be a valid URL")
    .or(z.string().length(0))
    .optional(),
  textTransform: z.enum(["none", "uppercase"]).optional(),
  letterSpacing: z.number().min(-5).max(50).optional(),
  padding: paddingSchema.optional(),
  condition: contentConditionSchema.optional(),
});

export const borderSchema = z.object({
  width: z.number().min(0).max(20).optional(),
  top: z.number().min(0).max(20).optional(),
  right: z.number().min(0).max(20).optional(),
  bottom: z.number().min(0).max(20).optional(),
  left: z.number().min(0).max(20).optional(),
  style: z.enum(["solid", "dashed", "dotted"]).optional(),
  color: z.string().optional(),
});

export const shadowSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  blur: z.number().optional(),
  color: z.string().optional(),
});

export const buttonSchema = z.object({
  text: z.string().min(1, "Button text is required"),
  href: z
    .string()
    .url("Must be a valid URL")
    .or(z.string().startsWith("#"))
    .or(z.string().length(0)),
  align: z.enum(["left", "center", "right"]),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().min(8).max(72).optional(),
  fontWeight: z.enum(["normal", "bold", "bolder"]).optional(),
  borderRadius: z.number().min(0).max(50).optional(),
  padding: paddingSchema.optional(),
  border: borderSchema.optional(),
  shadow: shadowSchema.optional(),
  textTransform: z.enum(["none", "uppercase"]).optional(),
  letterSpacing: z.number().min(-5).max(50).optional(),
  fullWidth: z.boolean().optional(),
  condition: contentConditionSchema.optional(),
});

export const imageSchema = z.object({
  src: z.string().url("Must be a valid image URL").or(z.string().length(0)),
  alt: z.string().optional(),
  href: z
    .string()
    .url("Must be a valid URL")
    .or(z.string().length(0))
    .optional(),
  width: z.number().min(0).max(1200).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  borderRadius: z.number().min(0).max(100).optional(),
  padding: paddingSchema.optional(),
  border: borderSchema.optional(),
  fullWidth: z.boolean().optional(),
  condition: contentConditionSchema.optional(),
});

export const spacerSchema = z.object({
  height: z.number().min(0).max(200),
  padding: paddingSchema.optional(),
  condition: contentConditionSchema.optional(),
});

export const listSchema = z.object({
  items: z
    .array(z.string().min(1, "Item text is required"))
    .min(1, "At least one item is required"),
  listType: z.enum(["ordered", "unordered"]),
  align: z.enum(["left", "center", "right"]),
  color: z.string().optional(),
  fontSize: z.number().min(8).max(128).optional(),
  lineHeight: z.number().min(0.5).max(3).step(0.1).optional(),
  fontWeight: z.enum(["normal", "bold", "bolder"]).optional(),
  padding: paddingSchema.optional(),
  condition: contentConditionSchema.optional(),
});

export const dividerSchema = z.object({
  color: z.string().optional(),
  width: z.number().min(1).max(100),
  align: z.enum(["left", "center", "right"]),
  borderWidth: z.number().min(1).max(20),
  borderStyle: z.enum(["solid", "dashed", "dotted"]),
  padding: paddingSchema.optional(),
  condition: contentConditionSchema.optional(),
});

const textStyleSchema = z.object({
  color: z.string().optional(),
  fontSize: z.number().min(8).max(128).optional(),
  lineHeight: z.number().min(0.5).max(3).step(0.1).optional(),
  fontWeight: z.enum(["normal", "bold", "bolder"]).optional(),
  fontFamily: z.string().optional(),
});

export const productLineSchema = z.object({
  leftText: z.string().min(1, "Left text is required"),
  rightText: z.string().min(1, "Right text is required"),
  leftStyle: textStyleSchema.optional(),
  rightStyle: textStyleSchema.optional(),
  rightWidth: z.number().min(60).max(300).optional(),
  padding: paddingSchema.optional(),
  condition: contentConditionSchema.optional(),
});

const socialLinkEditorSchema = z.object({
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

export const socialsSchema = z.object({
  links: z
    .array(socialLinkEditorSchema)
    .min(1, "At least one social link is required"),
  align: z.enum(["left", "center", "right"]),
  size: z.number().min(16).max(64).optional(),
  spacing: z.number().min(0).max(50).optional(),
  padding: paddingSchema.optional(),
  condition: contentConditionSchema.optional(),
});

export const globalSettingsSchema = z.object({
  backgroundColor: z.string().optional(),
  contentWidth: z.number().min(300).max(1200).optional(),
  fontFamily: z.string().optional(),
  textColor: z.string().optional(),
});

export type BlockSchemas = {
  heading: typeof headingSchema;
  paragraph: typeof paragraphSchema;
  button: typeof buttonSchema;
  image: typeof imageSchema;
  spacer: typeof spacerSchema;
  list: typeof listSchema;
  divider: typeof dividerSchema;
  "product-line": typeof productLineSchema;
  socials: typeof socialsSchema;
};
