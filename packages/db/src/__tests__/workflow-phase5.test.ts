// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aesGcmCipher } from "@senlo/core";
import type { Database } from "../client";
import * as schema from "../schema";
import { ProjectRepository } from "../repositories/projectRepository";
import { TriggeredSendLogRepository } from "../repositories/triggeredSendLogRepository";
import { WorkflowExecutionRepository } from "../repositories/workflowExecutionRepository";
import { WorkflowRepository } from "../repositories/workflowRepository";
import { createTestDb, seedCampaign } from "./test-db";

let db: Database;
let close: () => Promise<void>;
let executions: WorkflowExecutionRepository;
let workflows: WorkflowRepository;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  executions = new WorkflowExecutionRepository(db);
  workflows = new WorkflowRepository(db, aesGcmCipher("test-secrets-key"));
});

afterEach(async () => {
  await close();
});

async function seed(projectId?: number) {
  let pid = projectId;
  if (pid === undefined) {
    const userId = `user-${Math.random().toString(36).slice(2)}`;
    await db.insert(schema.users).values({ id: userId, email: `${userId}@example.com` });
    const [project] = await db.insert(schema.projects).values({ userId, name: "Project" }).returning();
    pid = project.id;
  }
  const [contact] = await db.insert(schema.contacts).values({ projectId: pid, email: "ann@x.io" }).returning();
  const [workflow] = await db.insert(schema.workflows).values({ projectId: pid, name: "W", status: "ACTIVE" }).returning();
  const version = await workflows.publishVersion(workflow.id, { nodes: [{ id: "t", type: "trigger", data: { event: "x" } }], edges: [] });
  return { projectId: pid, contactId: contact.id, workflowId: workflow.id, versionId: version.id };
}

const newRun = (ids: { workflowId: number; contactId: number; versionId: number }, isTest = false) =>
  executions.create({ ...ids, context: { steps: {} }, currentNodeId: "t", isTest });

describe("test runs", () => {
  it("run beside a real run and stay out of the stats, entry rules and the running lookup", async () => {
    const ids = await seed();
    const real = (await newRun(ids))!;
    const test = await newRun(ids, true);
    const second = await newRun(ids, true);
    expect(test).toMatchObject({ isTest: true });
    expect(second).not.toBeNull();
    expect(await newRun(ids)).toBeNull();

    expect((await executions.findRunningByContact(ids.workflowId, ids.contactId))?.id).toBe(real.id);
    expect((await executions.getRunStats(ids.workflowId)).started).toBe(1);
    await executions.claimStep(test!.id, "t");
    expect(await executions.getNodeStats(ids.workflowId)).toEqual([]);
    expect((await executions.lastStartedAt(ids.workflowId, ids.contactId))?.getTime()).toBe(real.startedAt.getTime());
  });

  it("run on test versions numbered below zero; publishing keeps counting from the last real version", async () => {
    const ids = await seed();
    const graph = { nodes: [], edges: [] };
    expect((await workflows.createTestVersion(ids.workflowId, graph)).version).toBe(-1);
    expect((await workflows.createTestVersion(ids.workflowId, graph, { kind: "lifecycle" }))).toMatchObject({ version: -2, isTest: true });
    expect((await workflows.publishVersion(ids.workflowId, graph)).version).toBe(2);
    expect((await workflows.findById(ids.workflowId))?.activeVersionId).not.toBeNull();
  });
});

describe("restart and generations", () => {
  it("moves the run back with a fresh context and the next generation; step rows are per generation", async () => {
    const ids = await seed();
    const run = (await newRun(ids))!;
    const first = await executions.claimStep(run.id, "a");
    await executions.updateStepExecution(first.id, { status: "COMPLETED" });
    await executions.startWait(run.id, { nodeId: "t", event: "e", wakeAt: new Date(Date.now() + 60_000) });

    const restarted = await executions.restart(run.id, {
      versionId: ids.versionId,
      context: { event: { name: "x", payload: { n: 2 } }, steps: {} },
      currentNodeId: "t",
      goalEvent: "paid",
    });
    expect(restarted).toMatchObject({ generation: 1, waitingEvent: null, goalEvent: "paid", currentNodeId: "t" });
    expect(restarted!.context.event).toEqual({ name: "x", payload: { n: 2 } });

    const again = await executions.claimStep(run.id, "a", 1);
    expect(again.id).not.toBe(first.id);
    expect(again).toMatchObject({ status: "PENDING", generation: 1 });
    expect((await executions.getStepExecutions(run.id, 1)).map((s) => s.id)).toEqual([again.id]);
    expect(await executions.getStepExecutions(run.id)).toHaveLength(2);
    expect((await executions.findDue(new Date(Date.now() + 1000), 10)).find((d) => d.id === run.id)).toMatchObject({ generation: 1 });

    await executions.finish(run.id, { status: "COMPLETED", exitReason: "completed" });
    expect(await executions.restart(run.id, { versionId: ids.versionId, context: { steps: {} }, currentNodeId: "t", goalEvent: null })).toBeNull();
  });
});

describe("runs list", () => {
  it("lists a workflow's runs newest first with filters, and a contact's runs with workflow names", async () => {
    const ids = await seed();
    const a = (await newRun(ids))!;
    await executions.finish(a.id, { status: "COMPLETED", exitReason: "completed" });
    const b = (await newRun(ids))!;
    const t = (await newRun(ids, true))!;

    expect((await executions.listRuns(ids.workflowId, { limit: 10 })).map((r) => r.id)).toEqual([b.id, a.id]);
    expect((await executions.listRuns(ids.workflowId, { limit: 10, includeTests: true })).map((r) => r.id)).toEqual([t.id, b.id, a.id]);
    expect((await executions.listRuns(ids.workflowId, { limit: 10, status: "COMPLETED" })).map((r) => r.id)).toEqual([a.id]);
    expect((await executions.listRuns(ids.workflowId, { limit: 10, beforeId: b.id })).map((r) => r.id)).toEqual([a.id]);
    expect((await executions.listRuns(ids.workflowId, { limit: 1 }))[0]).toMatchObject({ id: b.id, contactEmail: "ann@x.io", isTest: false });

    const history = await executions.listContactRuns(ids.contactId, 10);
    expect(history.map((r) => r.id)).toEqual([t.id, b.id, a.id]);
    expect(history[0]).toMatchObject({ workflowName: "W" });

    expect(await executions.cancel(b.id, "cancelled_user")).toBe(true);
    expect(await executions.cancel(b.id, "cancelled_user")).toBe(false);
    expect(await executions.findById(b.id)).toMatchObject({ status: "CANCELLED", exitReason: "cancelled_user" });
  });
});

describe("frequency cap count", () => {
  it("counts the project's automation emails to an address since a time", async () => {
    const { campaignId, projectId } = await seedCampaign(db);
    const other = await seedCampaign(db);
    const logs = new TriggeredSendLogRepository(db);
    const row = { email: "ann@x.io", status: "SUCCESS" as const, error: null, data: null };
    await logs.create({ ...row, campaignId, workflowExecutionId: 1 });
    await logs.createOnce({ ...row, campaignId, workflowExecutionId: 2 }, "wf-2-mail");
    await logs.create({ ...row, campaignId }); // an API send
    await logs.create({ ...row, campaignId: other.campaignId, workflowExecutionId: 3 }); // another project
    await logs.create({ ...row, email: "bob@x.io", campaignId, workflowExecutionId: 4 });

    const since = new Date(Date.now() - 60_000);
    expect(await logs.countAutomationSends(projectId, "ann@x.io", since)).toBe(2);
    expect(await logs.countAutomationSends(projectId, "ann@x.io", new Date(Date.now() + 60_000))).toBe(0);
    expect((await logs.findByDedupeKey("wf-2-mail"))?.workflowExecutionId).toBe(2);
  });

  it("stores the workspace's automation settings", async () => {
    const { projectId } = await seedCampaign(db);
    const projects = new ProjectRepository(db);
    expect((await projects.findById(projectId))?.automationSettings).toEqual({});
    await projects.update(projectId, { automationSettings: { frequencyCap: { emails: 3, days: 7 } } });
    expect((await projects.findById(projectId))?.automationSettings).toEqual({ frequencyCap: { emails: 3, days: 7 } });
  });
});

describe("step secrets", () => {
  it("seal and open with the repositories' cipher; a foreign token opens to null", async () => {
    const token = await workflows.sealSecret("Bearer s3cret");
    expect(token).not.toContain("s3cret");
    expect(await workflows.openSecret(token)).toBe("Bearer s3cret");
    const other = new WorkflowRepository(db, aesGcmCipher("another-key"));
    expect(await other.openSecret(token)).toBeNull();
    await expect(new WorkflowRepository(db).sealSecret("x")).rejects.toThrow("without a SecretCipher");
  });
});
