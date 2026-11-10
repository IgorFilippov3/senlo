// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Database } from "../client";
import * as schema from "../schema";
import { WorkflowExecutionRepository } from "../repositories/workflowExecutionRepository";
import { WorkflowRepository } from "../repositories/workflowRepository";
import { prepareAutomationsForPush } from "../automations-upgrade";
import { TriggeredSendLogRepository } from "../repositories/triggeredSendLogRepository";
import { seedCampaign } from "./test-db";
import { eq } from "drizzle-orm";
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
  const version = await new WorkflowRepository(db).publishVersion(workflow.id, {
    nodes: [
      { id: "t", type: "trigger", data: { event: "x" } },
      { id: "a", type: "delay", data: {} },
      { id: "b", type: "exit", data: {} },
    ],
    edges: [],
  });
  return { workflowId: workflow.id, contactId: contact.id, versionId: version.id, projectId: project.id };
}

describe("workflow execution context", () => {
  it("stores the run's context and reads it back", async () => {
    const ids = await seedWorkflow();
    const context = { event: { name: "order_created", payload: { total: 42, items: [{ sku: "a" }] } }, steps: {} };

    const run = await executions.create({ ...ids, versionId: ids.versionId, context, currentNodeId: "t" });

    expect(run?.context).toEqual(context);
    expect((await executions.findById(run!.id))?.context).toEqual(context);
  });

  it("a row written without a context reads as an empty one", async () => {
    const ids = await seedWorkflow();
    const [row] = await db
      .insert(schema.workflowExecutions)
      .values({ workflowId: ids.workflowId, contactId: ids.contactId, status: "RUNNING" })
      .returning();
    expect((await executions.findById(row.id))?.context).toEqual({ steps: {} });
  });
});

describe("guarded run transitions", () => {
  const start = async () => {
    const ids = await seedWorkflow();
    const run = await executions.create({ ...ids, context: { steps: {} }, currentNodeId: "t" });
    return { ...ids, run: run! };
  };

  it("one RUNNING run per contact and workflow; a new one after it ends", async () => {
    const { run, workflowId, contactId, versionId } = await start();
    expect(await executions.create({ workflowId, contactId, versionId, context: { steps: {} }, currentNodeId: "t" })).toBeNull();

    await executions.finish(run.id, { status: "COMPLETED", exitReason: "completed" });
    const next = await executions.create({ workflowId, contactId, versionId, context: { steps: {} }, currentNodeId: "t" });
    expect(next).not.toBeNull();
  });

  it("moves the cursor only from where the run is, and completes the step with it", async () => {
    const { run } = await start();
    const wakeAt = new Date(Date.now() + 60_000);
    const step = await executions.claimStep(run.id, "t");

    expect(await executions.moveCursor(run.id, { from: "elsewhere", to: "a", wakeAt })).toBe(false);
    expect(await executions.moveCursor(run.id, { from: "t", to: "a", wakeAt, completeStep: { id: step.id, result: { branch: "yes" } } })).toBe(true);
    expect(await executions.moveCursor(run.id, { from: "t", to: "a", wakeAt })).toBe(false);

    const after = await executions.findById(run.id);
    expect(after).toMatchObject({ currentNodeId: "a" });
    expect(after?.wakeAt?.getTime()).toBe(wakeAt.getTime());
    expect((await executions.getStepExecutions(run.id))[0]).toMatchObject({ status: "COMPLETED", result: { branch: "yes" } });
  });

  it("ends a run once; a guarded end from another step does nothing", async () => {
    const { run } = await start();
    expect(await executions.finish(run.id, { status: "FAILED", exitReason: "error", from: "a" })).toBe(false);
    expect(await executions.finish(run.id, { status: "COMPLETED", exitReason: "exit_node", from: "t" })).toBe(true);
    expect(await executions.finish(run.id, { status: "CANCELLED", exitReason: "cancelled_api" })).toBe(false);
    expect(await executions.findById(run.id)).toMatchObject({ status: "COMPLETED", exitReason: "exit_node", wakeAt: null });
  });

  it("claims a step once and hands the same row back", async () => {
    const { run } = await start();
    const first = await executions.claimStep(run.id, "a");
    const again = await executions.claimStep(run.id, "a");
    expect(again.id).toBe(first.id);
    expect(await executions.getStepExecutions(run.id)).toHaveLength(1);
  });
});

describe("db:upgrade-automations --before-push", () => {
  it("leaves one RUNNING run per contact and workflow and one row per step", async () => {
    // Rows as the old engine could leave them; the indexes are dropped to allow them.
    await db.execute(sql`DROP INDEX workflow_executions_running_contact_unq`);
    await db.execute(sql`ALTER TABLE workflow_step_executions DROP CONSTRAINT workflow_step_executions_execution_node_unq`);
    const ids = await seedWorkflow();
    const values = { workflowId: ids.workflowId, contactId: ids.contactId, status: "RUNNING" };
    const [older] = await db.insert(schema.workflowExecutions).values(values).returning();
    const [newer] = await db.insert(schema.workflowExecutions).values(values).returning();
    await db.insert(schema.workflowStepExecutions).values({ executionId: newer.id, nodeId: "a", status: "FAILED" });
    await db.insert(schema.workflowStepExecutions).values({ executionId: newer.id, nodeId: "a", status: "COMPLETED" });

    expect(await prepareAutomationsForPush(db)).toEqual({ duplicateRunsCancelled: 1, duplicateStepsDeleted: 1 });

    expect(await executions.findById(older.id)).toMatchObject({ status: "CANCELLED" });
    expect(await executions.findById(newer.id)).toMatchObject({ status: "RUNNING" });
    expect(await executions.getStepExecutions(newer.id)).toEqual([expect.objectContaining({ status: "COMPLETED" })]);
    expect(await prepareAutomationsForPush(db)).toEqual({ duplicateRunsCancelled: 0, duplicateStepsDeleted: 0 });
  });
});

describe("send log dedupe key", () => {
  it("creates one row per key and counts it once", async () => {
    const { campaignId } = await seedCampaign(db);
    const logs = new TriggeredSendLogRepository(db);
    const data = { campaignId, email: "r@x.io", status: "SUCCESS" as const, error: null, data: { a: 1 } };

    const first = await logs.createOnce(data, "wf-1-mail");
    const again = await logs.createOnce(data, "wf-1-mail");
    const other = await logs.createOnce(data, "wf-2-mail");

    expect(first.created).toBe(true);
    expect(again).toMatchObject({ created: false, log: { id: first.log.id } });
    expect(other.created).toBe(true);
    expect(await logs.findByDedupeKey("wf-1-mail")).toMatchObject({ id: first.log.id });
    expect(await logs.getStatsByCampaign(campaignId)).toMatchObject({ sent: 2 });
    const rows = await db.select().from(schema.triggeredSendLogs).where(eq(schema.triggeredSendLogs.campaignId, campaignId));
    expect(rows).toHaveLength(2);
  });
});
