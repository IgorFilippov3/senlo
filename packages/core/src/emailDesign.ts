import { z } from "zod";
import { contentBlockSchema } from "./blocks/registry";
import { contentConditionSchema, paddingSchema } from "./blocks/shared";

export const emailDesignVersion = 1;

export type RowId = string;
export type ColumnId = string;
export type ContentBlockId = string;

export type ContentBlockType =
  | "heading"
  | "paragraph"
  | "image"
  | "button"
  | "spacer"
  | "list"
  | "divider"
  | "product-line"
  | "socials";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "gt"
  | "lt"
  | "is_set"
  | "is_not_set";

export interface ContentCondition {
  variable: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
}

export interface BaseContentBlock {
  id: ContentBlockId;
  type: ContentBlockType;
  condition?: ContentCondition;
}

export interface HeadingBlock extends BaseContentBlock {
  type: "heading";
  data: {
    text: string;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    align?: "left" | "center" | "right";
    color?: string;
    fontSize?: number;
    lineHeight?: number;
    fontWeight?: "normal" | "bold" | "bolder";
    href?: string;
    textTransform?: "none" | "uppercase";
    letterSpacing?: number;
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

export interface ParagraphBlock extends BaseContentBlock {
  type: "paragraph";
  data: {
    text: string;
    align?: "left" | "center" | "right";
    color?: string;
    fontSize?: number;
    lineHeight?: number;
    fontWeight?: "normal" | "bold" | "bolder";
    href?: string;
    textTransform?: "none" | "uppercase";
    letterSpacing?: number;
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

export interface ImageBlock extends BaseContentBlock {
  type: "image";
  data: {
    src: string;
    alt?: string;
    href?: string;
    width?: number; // px
    align?: "left" | "center" | "right";
    borderRadius?: number;
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    border?: {
      width?: number;
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
      style?: "solid" | "dashed" | "dotted";
      color?: string;
    };
    fullWidth?: boolean;
  };
}

export interface ButtonBlock extends BaseContentBlock {
  type: "button";
  data: {
    text: string;
    href: string;
    align?: "left" | "center" | "right";
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "bolder";
    borderRadius?: number;
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    border?: {
      width?: number;
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
      style?: "solid" | "dashed" | "dotted";
      color?: string;
    };
    shadow?: {
      x?: number;
      y?: number;
      blur?: number;
      color?: string;
    };
    textTransform?: "none" | "uppercase";
    letterSpacing?: number;
    fullWidth?: boolean;
  };
}

export interface SpacerBlock extends BaseContentBlock {
  type: "spacer";
  data: {
    height: number; // px
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

export interface ListBlock extends BaseContentBlock {
  type: "list";
  data: {
    items: string[];
    listType: "ordered" | "unordered";
    align?: "left" | "center" | "right";
    color?: string;
    fontSize?: number;
    lineHeight?: number;
    fontWeight?: "normal" | "bold" | "bolder";
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

export interface DividerBlock extends BaseContentBlock {
  type: "divider";
  data: {
    color?: string;
    width?: number; // percents
    align?: "left" | "center" | "right";
    borderWidth?: number;
    borderStyle?: "solid" | "dashed" | "dotted";
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

export interface ProductLineBlock extends BaseContentBlock {
  type: "product-line";
  data: {
    leftText: string;
    rightText: string;
    leftStyle?: {
      color?: string;
      fontSize?: number;
      lineHeight?: number;
      fontWeight?: "normal" | "bold" | "bolder";
      fontFamily?: string;
    };
    rightStyle?: {
      color?: string;
      fontSize?: number;
      lineHeight?: number;
      fontWeight?: "normal" | "bold" | "bolder";
      fontFamily?: string;
    };
    rightWidth?: number; // px
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

export interface SocialLink {
  type:
    | "facebook"
    | "twitter"
    | "instagram"
    | "youtube"
    | "discord"
    | "github"
    | "reddit";
  url: string;
  icon: string; // URL for icon
}

export interface SocialsBlock extends BaseContentBlock {
  type: "socials";
  data: {
    links: SocialLink[];
    align?: "left" | "center" | "right";
    size?: number; // icon size in pixels
    spacing?: number; // spacing between icons in pixels
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
  };
}

export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | SpacerBlock
  | ListBlock
  | DividerBlock
  | ProductLineBlock
  | SocialsBlock;

/*
 * ===== LAYOUT: ROW / COLUMN =====
 */

export interface ColumnBlock {
  id: ColumnId;
  width: number; // percents, for example 100 / 50 / 33 etc.
  blocks: ContentBlock[];
}

export interface RowLoop {
  variable: string;
  alias: string;
}

export interface RowBlock {
  id: RowId;
  type: "row";
  columns: ColumnBlock[];
  condition?: ContentCondition;
  loop?: RowLoop;
  settings: {
    backgroundColor?: string;
    fullWidth?: boolean;
    align?: "left" | "center";
    padding?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    borderRadius?: {
      top?: number;
      bottom?: number;
    };
  };
}

/*
 * ===== GLOBAL SETTINGS =====
 */

export interface GlobalSettings {
  backgroundColor?: string;
  contentWidth?: number; // px
  fontFamily?: string;
  textColor?: string;
}

/*
 * ===== ROOT DOCUMENT =====
 */

export interface EmailDesignDocument {
  version: number;
  rows: RowBlock[];
  settings: GlobalSettings;
}

/*
 * ===== ZOD SCHEMAS =====
 */

export const globalSettingsSchema = z.object({
  backgroundColor: z.string().optional(),
  contentWidth: z.number().int().positive().optional(),
  fontFamily: z.string().optional(),
  textColor: z.string().optional(),
});

/*
 * Block shapes are described once, in `src/blocks/<type>.ts`, and assembled
 * into a schema by the registry. They are re-exported here because this module
 * is the document's public surface, and because a lot of code already imports
 * them from it.
 */
export {
  paddingSchema,
  borderSchema,
  shadowSchema,
  textStyleSchema,
  alignSchema,
  socialLinkSchema,
  urlLikeSchema,
  conditionOperatorSchema,
  contentConditionSchema,
} from "./blocks/shared";

export { contentBlockSchema } from "./blocks/registry";

export const rowLoopSchema = z.object({
  variable: z.string(),
  alias: z.string(),
});

export const columnBlockSchema = z.object({
  id: z.string(),
  width: z.number(),
  blocks: z.array(contentBlockSchema),
});

export const rowBlockSchema = z.object({
  id: z.string(),
  type: z.literal("row"),
  columns: z.array(columnBlockSchema).min(1),
  condition: contentConditionSchema.optional(),
  loop: rowLoopSchema.optional(),
  settings: z
    .object({
      backgroundColor: z.string().optional(),
      fullWidth: z.boolean().optional(),
      align: z.enum(["left", "center"]).optional(),
      padding: paddingSchema.optional(),
      borderRadius: z
        .object({
          top: z.number().int().nonnegative().optional(),
          bottom: z.number().int().nonnegative().optional(),
        })
        .optional(),
    })
    .optional()
    .default({}),
});

export const emailDesignDocumentSchema = z.object({
  version: z.number().default(emailDesignVersion),
  rows: z.array(rowBlockSchema),
  settings: globalSettingsSchema.default({}),
});

export type EmailDesignDocumentDTO = z.infer<typeof emailDesignDocumentSchema>;
export type RowBlockDTO = z.infer<typeof rowBlockSchema>;
export type ColumnBlockDTO = z.infer<typeof columnBlockSchema>;
export type ContentBlockDTO = z.infer<typeof contentBlockSchema>;
