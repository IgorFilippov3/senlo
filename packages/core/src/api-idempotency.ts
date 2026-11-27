// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { canonical } from "./canonical-json";
import { IdempotencyInProgressError, IdempotencyKeyReusedError, ValidationError } from "./errors";
import type { IApiIdempotencyRepository } from "./ports";
import { MAX_IDEMPOTENCY_KEY_LENGTH } from "./workflow-events";

/** How long a key answers with its first response. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * A first request still unfinished after this long is taken to have died
 * (a restart mid-request): a retry runs it again instead of waiting a day.
 */
export const IDEMPOTENCY_STALE_MS = 60 * 1000;

/** What `begin` decided: run the request (and report back), or answer as before. */
export type IdempotencyStart = { run: true; id: number } | { run: false; status: number; body: unknown };

/**
 * `Idempotency-Key` for API v1's creating routes. The same key with the same
 * request within a day answers with the first response and runs nothing;
 * with a different request it is refused. Only successful answers are kept:
 * after a failure the key is freed, so the corrected request can retry it.
 */
export class ApiIdempotency {
  constructor(
    private readonly repo: IApiIdempotencyRepository,
    private readonly now: () => number = Date.now,
  ) {}

  /** `operation` is the method and route (`POST /api/v1/templates`); `body` the parsed request. */
  async begin(projectId: number, rawKey: string, operation: string, body: unknown): Promise<IdempotencyStart> {
    const key = rawKey.trim();
    if (!key || key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new ValidationError(
        `Idempotency-Key must be 1 to ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
        undefined,
        "Send a unique value per request, such as a UUID.",
      );
    }
    const requestHash = createHash("sha256")
      .update(JSON.stringify(canonical(body ?? null)))
      .digest("hex");
    const data = { projectId, key, operation, requestHash };
    const expiredBefore = new Date(this.now() - IDEMPOTENCY_TTL_MS);

    let claim = await this.repo.claim(data, expiredBefore);
    if (!claim.claimed && claim.record.statusCode === null && this.now() - claim.record.createdAt.getTime() > IDEMPOTENCY_STALE_MS) {
      await this.repo.release(claim.record.id);
      claim = await this.repo.claim(data, expiredBefore);
    }
    if (claim.claimed) return { run: true, id: claim.id };

    const { record } = claim;
    if (record.operation !== operation || record.requestHash !== requestHash) throw new IdempotencyKeyReusedError();
    if (record.statusCode === null) throw new IdempotencyInProgressError();
    return { run: false, status: record.statusCode, body: record.response };
  }

  /** Keeps a successful answer for retries. */
  complete(id: number, status: number, body: unknown): Promise<void> {
    return this.repo.complete(id, status, body);
  }

  /** Frees the key after a failure. */
  release(id: number): Promise<void> {
    return this.repo.release(id);
  }
}
