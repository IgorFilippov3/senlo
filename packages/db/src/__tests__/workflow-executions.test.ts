// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../client";
import * as schema from "../schema";
import { WorkflowExecutionRepository } from "../repositories/workflowExecutionRepository";
import { createTestDb } from "./test-db";

let db: Database;
let close: () => Promise<void>;
let executions: WorkflowExecutionRepository;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  executions = new WorkflowExecutionRepository(db);
});

afterEach(async () => {
  await close();
});

async function seedWorkflow() {
  const userId = `user-${Math.random().toString(36).slice(2)}`;
  await db.insert(schema.users).values({ id: userId, email: `${userId}@example.com` });
  const [project] = await db.insert(schema.projects).values({ userId, name: "Project" }).returning();
  const [contact] = await db.insert(schema.contacts).values({ projectId: project.id, email: "ann@x.io" }).returning();
  const [workflow] = await db.insert(schema.workflows).values({ projectId: project.id, name: "W", status: "ACTIVE" }).returning();
  return { workflowId: workflow.id, contactId: contact.id };
}

describe("workflow execution context", () => {
  it("stores the run's context and reads it back", async () => {
    const ids = await seedWorkflow();
    const context = { event: { name: "order_created", payload: { total: 42, items: [{ sku: "a" }] } }, steps: {} };

    const run = await executions.create({ ...ids, status: "RUNNING", versionId: null, context });

    expect(run.context).toEqual(context);
    expect((await executions.findById(run.id))?.context).toEqual(context);
  });

  it("a row written without a context reads as an empty one", async () => {
    const ids = await seedWorkflow();
    const [row] = await db.insert(schema.workflowExecutions).values({ ...ids, status: "RUNNING" }).returning();
    expect((await executions.findById(row.id))?.context).toEqual({ steps: {} });
  });
});
