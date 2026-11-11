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

  it("finds RUNNING runs due before a time, oldest first", async () => {
    const a = await start();
    const b = await start();
    const c = await start();
    const now = Date.now();
    await executions.moveCursor(a.run.id, { from: "t", to: "a", wakeAt: new Date(now - 10 * 60_000) });
    await executions.moveCursor(b.run.id, { from: "t", to: "a", wakeAt: new Date(now - 20 * 60_000) });
    await executions.moveCursor(c.run.id, { from: "t", to: "a", wakeAt: new Date(now + 60_000) });

    expect(await executions.findDue(new Date(now - 2 * 60_000), 10)).toEqual([
      { id: b.run.id, currentNodeId: "a" },
      { id: a.run.id, currentNodeId: "a" },
    ]);
    expect(await executions.findDue(new Date(now), 1)).toHaveLength(1);

    await executions.finish(b.run.id, { status: "COMPLETED", exitReason: "completed" });
    expect((await executions.findDue(new Date(now), 10)).map((r) => r.id)).toEqual([a.run.id]);
  });

  it("cancels a contact's RUNNING runs, of one workflow when given", async () => {
    const first = await start();
    const second = await start();
    // Same contact in another workflow of the same project.
    const [other] = await db
      .insert(schema.workflows)
      .values({ projectId: first.projectId, name: "Other", status: "ACTIVE" })
      .returning();
    const otherVersion = await new WorkflowRepository(db).publishVersion(other.id, { nodes: [], edges: [] });
    const otherRun = await executions.create({
      workflowId: other.id,
      contactId: first.contactId,
      versionId: otherVersion.id,
      context: { steps: {} },
      currentNodeId: "t",
    });

    expect(await executions.cancelRunning(first.contactId, { workflowId: other.id, exitReason: "cancelled_api" })).toEqual([otherRun!.id]);
    expect(await executions.cancelRunning(first.contactId, { exitReason: "cancelled_api" })).toEqual([first.run.id]);
    expect(await executions.cancelRunning(first.contactId, { exitReason: "cancelled_api" })).toEqual([]);
    expect(await executions.findById(first.run.id)).toMatchObject({ status: "CANCELLED", exitReason: "cancelled_api", wakeAt: null });
    expect(await executions.findById(second.run.id)).toMatchObject({ status: "RUNNING" });
  });

  it("waits for an event: one start, one resolution, and the waiting runs are found by event", async () => {
    const { run, contactId } = await start();
    await executions.moveCursor(run.id, { from: "t", to: "a", wakeAt: new Date() });
    const timeout = new Date(Date.now() + 3 * 86_400_000);

    expect(await executions.startWait(run.id, { nodeId: "b", event: "paid", wakeAt: timeout })).toBe(false);
    expect(await executions.startWait(run.id, { nodeId: "a", event: "paid", wakeAt: timeout })).toBe(true);
    expect(await executions.startWait(run.id, { nodeId: "a", event: "paid", wakeAt: timeout })).toBe(false);
    expect((await executions.findWaiting(contactId, "paid")).map((r) => r.id)).toEqual([run.id]);
    expect(await executions.findWaiting(contactId, "other")).toEqual([]);

    expect(await executions.resolveWait(run.id, { nodeId: "a", event: "paid" })).toBe(true);
    expect(await executions.resolveWait(run.id, { nodeId: "a", event: "paid" })).toBe(false);
    expect(await executions.findWaiting(contactId, "paid")).toEqual([]);
  });

  it("finds runs by goal and stores step outputs in the context", async () => {
    const ids = await seedWorkflow();
    const run = await executions.create({ ...ids, context: { event: { name: "x", payload: { a: 1 } }, steps: {} }, currentNodeId: "t", goalEvent: "paid" });
    expect((await executions.findByGoal(ids.contactId, "paid")).map((r) => r.id)).toEqual([run!.id]);

    await executions.setStepOutput(run!.id, "w", { plan: "pro" });
    await executions.setStepOutput(run!.id, "h", null);
    expect((await executions.findById(run!.id))?.context).toEqual({
      event: { name: "x", payload: { a: 1 } },
      steps: { w: { plan: "pro" }, h: null },
    });

    await executions.finish(run!.id, { status: "COMPLETED", exitReason: "goal" });
    expect(await executions.findByGoal(ids.contactId, "paid")).toEqual([]);
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

describe("workflow settings", () => {
  it("are stored on the draft and copied into the version", async () => {
    const ids = await seedWorkflow();
    const workflows = new WorkflowRepository(db);
    const settings = { kind: "lifecycle" as const, goal: { event: "paid" }, entry: { mode: "once" as const } };
    await workflows.update(ids.workflowId, { settings });
    expect((await workflows.findById(ids.workflowId))?.settings).toEqual(settings);
    const v = await workflows.publishVersion(ids.workflowId, { nodes: [], edges: [] }, settings);
    expect((await workflows.getVersion(v.id))?.settings).toEqual(settings);
  });
});

describe("email engagement", () => {
  it("an open or click of the log's campaign and address, at or after its send", async () => {
    const { campaignId } = await seedCampaign(db);
    const logs = new TriggeredSendLogRepository(db);
    const log = await logs.create({ campaignId, email: "Ann@x.io", status: "SUCCESS", error: null, data: null });
    const sentAt = (await logs.findById(log.id))!.sentAt;

    expect(await logs.hasEngagement(log.id, "OPEN")).toBe(false);

    // Before the send, another address, another type: none count.
    await db.insert(schema.campaignEvents).values([
      { campaignId, email: "ann@x.io", type: "OPEN", occurredAt: new Date(sentAt.getTime() - 60_000) },
      { campaignId, email: "bob@x.io", type: "OPEN", occurredAt: new Date(sentAt.getTime() + 60_000) },
      { campaignId, email: "ann@x.io", type: "DELIVERED", occurredAt: new Date(sentAt.getTime() + 60_000) },
    ]);
    expect(await logs.hasEngagement(log.id, "OPEN")).toBe(false);

    await db.insert(schema.campaignEvents).values({ campaignId, email: "ann@x.io", type: "OPEN", occurredAt: new Date(sentAt.getTime() + 120_000) });
    expect(await logs.hasEngagement(log.id, "OPEN")).toBe(true);
    expect(await logs.hasEngagement(log.id, "CLICK")).toBe(false);
    expect(await logs.hasEngagement(999_999, "OPEN")).toBe(false);
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
