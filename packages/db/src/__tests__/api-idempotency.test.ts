// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Database } from "../client";
import * as schema from "../schema";
import { ApiIdempotencyRepository } from "../repositories/apiIdempotencyRepository";
import { createTestDb } from "./test-db";

let db: Database;
let close: () => Promise<void>;
let keys: ApiIdempotencyRepository;
let projectId: number;
let otherProjectId: number;

const request = (key: string, over: Partial<{ operation: string; requestHash: string }> = {}) => ({
  projectId,
  key,
  operation: "POST /api/v1/templates",
  requestHash: "h1",
  ...over,
});
const longAgo = new Date("2000-01-01T00:00:00Z");

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  keys = new ApiIdempotencyRepository(db);
  const [a, b] = await db.insert(schema.projects).values([{ name: "A" }, { name: "B" }]).returning();
  projectId = a.id;
  otherProjectId = b.id;
});

afterEach(async () => {
  await close();
});

describe("ApiIdempotencyRepository", () => {
  it("claims a key once; the second claim gets the first record", async () => {
    const first = await keys.claim(request("k1"), longAgo);
    expect(first.claimed).toBe(true);

    const second = await keys.claim(request("k1", { requestHash: "h2" }), longAgo);
    expect(second).toMatchObject({
      claimed: false,
      record: { operation: "POST /api/v1/templates", requestHash: "h1", statusCode: null, response: null },
    });
  });

  it("keeps the answer, and frees the key on release", async () => {
    const first = await keys.claim(request("k1"), longAgo);
    if (!first.claimed) throw new Error("not claimed");
    await keys.complete(first.id, 201, { data: { id: 5 } });
    expect(await keys.claim(request("k1"), longAgo)).toMatchObject({
      claimed: false,
      record: { statusCode: 201, response: { data: { id: 5 } } },
    });

    await keys.release(first.id);
    expect((await keys.claim(request("k1"), longAgo)).claimed).toBe(true);
  });

  it("scopes keys to a project", async () => {
    await keys.claim(request("k1"), longAgo);
    expect((await keys.claim({ ...request("k1"), projectId: otherProjectId }, longAgo)).claimed).toBe(true);
  });

  it("deletes the project's expired keys when claiming", async () => {
    await keys.claim(request("old"), longAgo);
    await db.execute(sql`UPDATE api_idempotency_keys SET created_at = '2026-01-01T00:00:00Z'`);

    expect((await keys.claim(request("old"), new Date("2026-06-01T00:00:00Z"))).claimed).toBe(true);
    const rows = await db.select().from(schema.apiIdempotencyKeys);
    expect(rows).toHaveLength(1);
  });

  it("goes with its project", async () => {
    await keys.claim(request("k1"), longAgo);
    await db.delete(schema.projects);
    expect(await db.select().from(schema.apiIdempotencyKeys)).toEqual([]);
  });
});
