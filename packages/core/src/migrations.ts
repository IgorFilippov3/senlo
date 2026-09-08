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
