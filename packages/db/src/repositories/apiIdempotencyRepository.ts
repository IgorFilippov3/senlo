// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { and, eq, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IApiIdempotencyRepository, IdempotencyRecord } from "@senlo/core";
import * as schema from "../schema";
import { apiIdempotencyKeys } from "../schema";

/** API v1's `Idempotency-Key`s. The unique (project, key) is what makes a claim atomic. */
export class ApiIdempotencyRepository implements IApiIdempotencyRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async claim(
    data: { projectId: number; key: string; operation: string; requestHash: string },
    expiredBefore: Date,
  ): Promise<{ claimed: true; id: number } | { claimed: false; record: IdempotencyRecord }> {
    await this.db
      .delete(apiIdempotencyKeys)
      .where(and(eq(apiIdempotencyKeys.projectId, data.projectId), lt(apiIdempotencyKeys.createdAt, expiredBefore)));

    // Two tries: the row that blocked the insert can be released in between.
    for (let attempt = 0; attempt < 2; attempt++) {
      const [inserted] = await this.db
        .insert(apiIdempotencyKeys)
        .values(data)
        .onConflictDoNothing()
        .returning({ id: apiIdempotencyKeys.id });
      if (inserted) return { claimed: true, id: inserted.id };

      const [row] = await this.db
        .select()
        .from(apiIdempotencyKeys)
        .where(and(eq(apiIdempotencyKeys.projectId, data.projectId), eq(apiIdempotencyKeys.key, data.key)));
      if (row) {
        return {
          claimed: false,
          record: {
            id: row.id,
            operation: row.operation,
            requestHash: row.requestHash,
            statusCode: row.statusCode,
            response: row.response,
            createdAt: row.createdAt,
          },
        };
      }
    }
    throw new Error("Idempotency key could not be claimed");
  }

  async complete(id: number, statusCode: number, response: unknown): Promise<void> {
    await this.db.update(apiIdempotencyKeys).set({ statusCode, response }).where(eq(apiIdempotencyKeys.id, id));
  }

  async release(id: number): Promise<void> {
    await this.db.delete(apiIdempotencyKeys).where(eq(apiIdempotencyKeys.id, id));
  }
}
