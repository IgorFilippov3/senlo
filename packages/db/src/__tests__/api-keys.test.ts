// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Database } from "../client";
import * as schema from "../schema";
import { ApiKeyRepository } from "../repositories/apiKeyRepository";
import { createTestDb } from "./test-db";

let db: Database;
let close: () => Promise<void>;
let keys: ApiKeyRepository;
let projectId: number;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  keys = new ApiKeyRepository(db);
  const [project] = await db.insert(schema.projects).values({ name: "Project" }).returning();
  projectId = project.id;
});

afterEach(async () => {
  await close();
});

describe("API key permissions", () => {
  it("stores and reads back the permissions a key was created with", async () => {
    const created = await keys.create({
      projectId,
      name: "agent",
      keyHash: "h1",
      prefix: "snl_aaaaaaaa",
      permissions: ["send", "manage"],
    });
    expect(created.permissions).toEqual(["send", "manage"]);
    expect((await keys.findByHash("h1"))?.permissions).toEqual(["send", "manage"]);
  });

  it("gives a row written without permissions send only: what keys from before permissions get", async () => {
    await db.insert(schema.apiKeys).values({ projectId, name: "old", keyHash: "h2", prefix: "snl_bbbbbbbb" });
    expect((await keys.findByHash("h2"))?.permissions).toEqual(["send"]);
  });

  it("ignores a value it does not know", async () => {
    await db.execute(
      sql`INSERT INTO api_keys (project_id, name, key_hash, prefix, permissions) VALUES (${projectId}, 'odd', 'h3', 'snl_cccccccc', ARRAY['send','admin']::text[])`,
    );
    expect((await keys.findByHash("h3"))?.permissions).toEqual(["send"]);
  });
});
