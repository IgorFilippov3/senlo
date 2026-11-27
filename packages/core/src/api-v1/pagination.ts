// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ValidationError } from "../errors";

/** Page size of a v1 list when the caller names none, and the most it may ask for. */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** A page request: how many, and the id to continue below (newest first). */
export interface PageRequest {
  limit: number;
  beforeId: number | null;
}

export interface Page<T> {
  items: T[];
  /** Pass as `?cursor=` for the next page; null on the last one. */
  nextCursor: string | null;
}

/** An opaque cursor for "continue after this id". */
export function encodeCursor(id: number): string {
  return Buffer.from(`id:${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): number {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const match = /^id:(\d+)$/.exec(decoded);
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ValidationError(
      "cursor: Invalid cursor.",
      { issues: [{ path: "cursor", code: "custom", message: "Invalid cursor." }], issueCount: 1 },
      "Pass the nextCursor of the previous page unchanged, or leave cursor out for the first page.",
    );
  }
  return id;
}

/** `?limit=&cursor=` as a page request; a bad value is a `ValidationError` that names the parameter. */
export function parsePageQuery(params: URLSearchParams): PageRequest {
  const rawLimit = params.get("limit");
  let limit = DEFAULT_PAGE_SIZE;
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new ValidationError(
        `limit: Must be a whole number from 1 to ${MAX_PAGE_SIZE}.`,
        { issues: [{ path: "limit", code: "custom", message: `Must be a whole number from 1 to ${MAX_PAGE_SIZE}.` }], issueCount: 1 },
      );
    }
  }
  const cursor = params.get("cursor");
  return { limit, beforeId: cursor ? decodeCursor(cursor) : null };
}

/**
 * The page out of `rows`, fetched as `limit + 1` newest-first rows: the extra
 * one only says whether there is a next page.
 */
export function pageOf<T extends { id: number }>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null };
}
