// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ContentBlock, EmailDesignDocument, RowBlock } from "./emailDesign";
import { emailDesignVersion } from "./emailDesign";

/**
 * @fileoverview Bringing a stored document up to the current format.
 *
 * A document saved by an older version of the editor is reshaped here, once,
 * on the way in - when the editor loads it and when the renderer is handed
 * one. Everything past this file therefore sees a single shape, and the
 * knowledge of what the old one looked like lives in exactly one place instead
 * of being spread across every reader as an optional field.
 *
 * The database is not rewritten: a document is converted in memory and saved in
 * the new shape the next time the author saves it. A self-hosted installation
 * that only updates its code keeps working.
 */

type BlockMigration = (block: any) => any;

/**
 * Steps by the version they upgrade FROM: the entry under 1 turns a version 1
 * document into a version 2 one.
 */
const BLOCK_MIGRATIONS: Record<number, BlockMigration> = {
  1: migrateProductLineToItems,
  2: migrateBolderToBold,
  3: migrateImageRadiusToCorners,
};

/**
 * A product line used to be one label/value pair. It is a list of them now, so
 * the pair becomes a list of one.
 *
 * Idempotent: a block that already has `items` is returned untouched, which is
 * what lets the same step run over a saved row that carries no version.
 */
function migrateProductLineToItems(block: any): any {
  if (block?.type !== "product-line") return block;
  if (Array.isArray(block.data?.items)) return block;

  const { leftText, rightText, ...rest } = block.data ?? {};

  return {
    ...block,
    data: {
      ...rest,
      items: [{ left: leftText ?? "", right: rightText ?? "" }],
    },
  };
}

/**
 * `bolder` used to be a third font weight. No control ever offered it - every
 * panel listed Regular and Bold - and the five web-safe families the product
 * ships have exactly two faces, so a client asked for `bolder` drew the same
 * glyphs as `bold`. It could still reach a document through the AI endpoint,
 * which validates the model's output against the same schema, and a document
 * carrying it would then show an empty weight in the panel.
 *
 * Idempotent: a block with any other weight, or none, is returned untouched.
 */
function migrateBolderToBold(block: any): any {
  const data = block?.data;
  if (!data) return block;

  const fix = (weight: any) => (weight === "bolder" ? "bold" : weight);
  const fixStyle = (style: any) =>
    style && style.fontWeight === "bolder"
      ? { ...style, fontWeight: "bold" }
      : style;

  const next = {
    ...data,
    fontWeight: fix(data.fontWeight),
    // The product line carries a weight per column rather than one per block.
    leftStyle: fixStyle(data.leftStyle),
    rightStyle: fixStyle(data.rightStyle),
  };

  // `fontWeight` is optional, so writing it back unconditionally would add the
  // key to every block that never had one. Only a block that actually changed
  // gets a new object.
  if (
    next.fontWeight === data.fontWeight &&
    next.leftStyle === data.leftStyle &&
    next.rightStyle === data.rightStyle
  ) {
    return block;
  }

  if (data.fontWeight === undefined) delete next.fontWeight;
  if (data.leftStyle === undefined) delete next.leftStyle;
  if (data.rightStyle === undefined) delete next.rightStyle;

  return { ...block, data: next };
}

/**
 * An image's corner radius used to be one number for all four corners. It is a
 * corner object now, so the number becomes four equal corners.
 *
 * An image that never had a radius keeps not having one: writing four zeroes
 * into every image in every existing template would add a key to blocks that
 * never carried it, which is the same thing `migrateBolderToBold` goes out of
 * its way not to do.
 *
 * Idempotent: a block that is not an image, has no radius, or already carries
 * the object is returned untouched - which is what lets this run over a saved
 * row that has no version to say whether it has been here before.
 */
function migrateImageRadiusToCorners(block: any): any {
  if (block?.type !== "image") return block;

  const radius = block.data?.borderRadius;
  if (typeof radius !== "number") return block;

  const all = Number.isFinite(radius) && radius > 0 ? Math.round(radius) : 0;

  if (all === 0) {
    const { borderRadius, ...rest } = block.data;
    return { ...block, data: rest };
  }

  return {
    ...block,
    data: {
      ...block.data,
      borderRadius: {
        topLeft: all,
        topRight: all,
        bottomRight: all,
        bottomLeft: all,
      },
    },
  };
}

/** Applies a block migration to every block of a row, keeping the row's shape. */
function migrateRowBlocks(row: any, migrate: BlockMigration): any {
  if (!row || !Array.isArray(row.columns)) return row;

  return {
    ...row,
    columns: row.columns.map((column: any) => ({
      ...column,
      blocks: Array.isArray(column?.blocks)
        ? column.blocks.map((block: ContentBlock) => migrate(block))
        : column?.blocks,
    })),
  };
}

/**
 * Brings a stored document to the current format.
 *
 * Anything that is not a document - null from a template that was never
 * designed, a value of the wrong shape - is returned as it came, because this
 * runs on the edge where such values still exist.
 */
export function migrateEmailDesign<T>(design: T): T {
  if (!design || typeof design !== "object" || !Array.isArray((design as any).rows)) {
    return design;
  }

  let current: any = design;
  let version = Number(current.version) || 1;

  while (version < emailDesignVersion) {
    const migrate = BLOCK_MIGRATIONS[version];
    if (!migrate) break;

    current = {
      ...current,
      rows: current.rows.map((row: RowBlock) => migrateRowBlocks(row, migrate)),
    };
    version += 1;
  }

  if (current === design && version === Number((design as any).version)) {
    return design;
  }

  return { ...current, version: emailDesignVersion } as T;
}

/**
 * The same for a single row.
 *
 * The saved-row library stores a `RowBlock` on its own, with no version to read,
 * so every step runs and each one decides for itself whether it applies.
 */
export function migrateRow<T>(row: T): T {
  if (!row || typeof row !== "object") return row;

  let current: any = row;
  for (const migrate of Object.values(BLOCK_MIGRATIONS)) {
    current = migrateRowBlocks(current, migrate);
  }

  return current as T;
}
