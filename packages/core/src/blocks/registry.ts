// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import type { ContentBlockType } from "../emailDesign";
import { contentConditionSchema } from "./shared";
import type { BlockDefinition } from "./types";

import { headingBlock } from "./heading";
import { paragraphBlock } from "./paragraph";
import { imageBlock } from "./image";
import { buttonBlock } from "./button";
import { spacerBlock } from "./spacer";
import { listBlock } from "./list";
import { dividerBlock } from "./divider";
import { productLineBlock } from "./product-line";
import { socialsBlock } from "./socials";

/**
 * Every block type the product supports. Adding one means writing its
 * definition file and adding it here - the `Record` is typed by
 * `ContentBlockType`, so leaving it out is a compile error rather than a
 * silently missing `switch` case.
 */
export const BLOCK_REGISTRY: Record<ContentBlockType, BlockDefinition> = {
  heading: headingBlock,
  paragraph: paragraphBlock,
  image: imageBlock,
  button: buttonBlock,
  spacer: spacerBlock,
  list: listBlock,
  divider: dividerBlock,
  "product-line": productLineBlock,
  socials: socialsBlock,
};

/** Registration order, which is also the order the sidebar lists them in. */
export const CONTENT_BLOCK_TYPES = Object.keys(
  BLOCK_REGISTRY,
) as ContentBlockType[];

export function getBlockDefinition(
  type: ContentBlockType,
): BlockDefinition | undefined {
  return BLOCK_REGISTRY[type];
}

/** Data for a new block of this type. Always a fresh object. */
export function createBlockData(type: ContentBlockType): any {
  const definition = getBlockDefinition(type);
  if (!definition) {
    throw new Error(`Unknown block type: ${type}`);
  }
  return definition.createDefaults();
}

/** Human-readable summary of a block, for overlays and drag previews. */
export function describeBlock(block: { type: ContentBlockType }): string {
  const definition = getBlockDefinition(block.type);
  if (!definition) return `Block: ${block.type}`;
  return definition.describe ? definition.describe(block) : definition.label;
}

/**
 * The document-level schema for one block, assembled from the definition so a
 * block's shape is described exactly once.
 */
function blockSchemaFor(definition: BlockDefinition) {
  return z.object({
    id: z.string(),
    type: z.literal(definition.type),
    condition: contentConditionSchema.optional(),
    data: definition.dataSchema,
  });
}

const blockSchemas = CONTENT_BLOCK_TYPES.map((type) =>
  blockSchemaFor(BLOCK_REGISTRY[type]),
);

/**
 * Union of every block schema. Built with `z.union` rather than
 * `z.discriminatedUnion` because the members are assembled at runtime from the
 * registry; the error messages are slightly less precise, the coverage is the
 * same, and nothing can drift out of sync.
 */
export const contentBlockSchema = z.union(
  blockSchemas as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]],
);

/**
 * Schema for the editor's property form: the block's own data plus the
 * condition, which the form edits alongside it.
 */
export function formSchemaFor(type: ContentBlockType) {
  const definition = getBlockDefinition(type);
  if (!definition) return z.object({});

  return (definition.dataSchema as z.ZodObject<any>).extend({
    condition: contentConditionSchema.optional(),
  });
}
