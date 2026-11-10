// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { fixedLogRetention, ServiceHooks, type Logger } from "@senlo/core";
import { LogRetentionService } from "@senlo/core/server";
import type { Database } from "../client";
import * as schema from "../schema";
import { ContactEventRepository } from "../repositories/contactEventRepository";
import { LogRetentionRepository } from "../repositories/logRetentionRepository";
import { createTestDb } from "./test-db";

const quiet: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const NOW = new Date("2026-11-10T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

let db: Database;
let close: () => Promise<void>;
let events: ContactEventRepository;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  events = new ContactEventRepository(db);
});

afterEach(async () => {
  await close();
});

/** A user, a project and one contact in it; ids returned. */
async function seedContact(email = "bob@x.io") {
  const userId = `user-${Math.random().toString(36).slice(2)}`;
  await db.insert(schema.users).values({ id: userId, email: `${userId}@example.com` });
  const [project] = await db.insert(schema.projects).values({ userId, name: "Project" }).returning();
  const [contact] = await db.insert(schema.contacts).values({ projectId: project.id, email }).returning();
  return { projectId: project.id, contactId: contact.id };
}

async function age(id: number, days: number) {
  await db.update(schema.contactEvents).set({ createdAt: daysAgo(days) }).where(eq(schema.contactEvents.id, id));
}

describe("contact events", () => {
  it("records an event with its payload", async () => {
    const { projectId, contactId } = await seedContact();
    const e = await events.record({ projectId, contactId, name: "trial_started", payload: { plan: "pro" } });
    expect(e).toMatchObject({ projectId, contactId, name: "trial_started", payload: { plan: "pro" }, idempotencyKey: null });
    expect(await events.listByContact(contactId)).toHaveLength(1);
  });

  it("stores an idempotency key once per project; events without a key never collide", async () => {
    const a = await seedContact();
    const b = await seedContact();

    expect(await events.record({ ...a, name: "x", payload: {}, idempotencyKey: "k1" })).not.toBeNull();
    expect(await events.record({ ...a, name: "x", payload: {}, idempotencyKey: "k1" })).toBeNull();
    expect(await events.record({ ...b, name: "x", payload: {}, idempotencyKey: "k1" })).not.toBeNull();
    expect(await events.record({ ...a, name: "x", payload: {} })).not.toBeNull();
    expect(await events.record({ ...a, name: "x", payload: {} })).not.toBeNull();

    expect(await events.findByIdempotencyKey(a.projectId, "k1")).toMatchObject({ contactId: a.contactId });
    expect(await events.findByIdempotencyKey(a.projectId, "nope")).toBeNull();
    expect(await events.listByContact(a.contactId)).toHaveLength(3);
  });

  it("answers whether a contact did an event since a time", async () => {
    const { projectId, contactId } = await seedContact();
    const e = await events.record({ projectId, contactId, name: "project_created", payload: {} });
    await age(e!.id, 5);

    expect(await events.existsSince(contactId, "project_created", daysAgo(7))).toBe(true);
    expect(await events.existsSince(contactId, "project_created", daysAgo(3))).toBe(false);
    expect(await events.existsSince(contactId, "other", daysAgo(7))).toBe(false);
  });

  it("lists the project's event names, most recently used first", async () => {
    const { projectId, contactId } = await seedContact();
    const other = await seedContact();
    const old = await events.record({ projectId, contactId, name: "old", payload: {} });
    await age(old!.id, 10);
    const mid = await events.record({ projectId, contactId, name: "mid", payload: {} });
    await age(mid!.id, 5);
    await events.record({ projectId, contactId, name: "old", payload: {} }); // used again today
    await events.record({ ...other, name: "elsewhere", payload: {} });

    expect(await events.recentNames(projectId, 10)).toEqual(["old", "mid"]);
    expect(await events.recentNames(projectId, 1)).toEqual(["old"]);
  });

  it("retention deletes events past the project's days, in batches, even before the stats backfill", async () => {
    const { projectId, contactId } = await seedContact();
    for (let i = 0; i < 7; i++) {
      const e = await events.record({ projectId, contactId, name: "x", payload: { i } });
      await age(e!.id, 40);
    }
    await events.record({ projectId, contactId, name: "x", payload: { fresh: true } });

    const result = await new LogRetentionService(
      new LogRetentionRepository(db),
      new ServiceHooks({ retention: fixedLogRetention(30) }, quiet),
      quiet,
      { batchSize: 3, now: () => NOW },
    ).run();

    expect(result).toMatchObject({ status: "not_backfilled", contactEvents: 7 });
    const left = await events.listByContact(contactId);
    expect(left.map((e) => e.payload)).toEqual([{ fresh: true }]);
  });

  it("events go with their contact", async () => {
    const { projectId, contactId } = await seedContact();
    await events.record({ projectId, contactId, name: "x", payload: {} });
    await db.delete(schema.contacts).where(eq(schema.contacts.id, contactId));
    expect(await events.listByContact(contactId)).toEqual([]);
  });
});
