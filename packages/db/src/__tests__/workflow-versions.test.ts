// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import * as schema from "../schema";
import { normalizeNode, upgradeAutomations } from "../automations-upgrade";
import { WorkflowRepository } from "../repositories/workflowRepository";
import { WorkflowExecutionRepository } from "../repositories/workflowExecutionRepository";
import { createTestDb } from "./test-db";

let db: Database;
let close: () => Promise<void>;
let workflows: WorkflowRepository;
let executions: WorkflowExecutionRepository;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  workflows = new WorkflowRepository(db);
  executions = new WorkflowExecutionRepository(db);
});

afterEach(async () => {
  await close();
});

async function seed(status: "DRAFT" | "ACTIVE" | "PAUSED" = "ACTIVE") {
  const userId = `user-${Math.random().toString(36).slice(2)}`;
  await db.insert(schema.users).values({ id: userId, email: `${userId}@example.com` });
  const [project] = await db.insert(schema.projects).values({ userId, name: "Project" }).returning();
  const [contact] = await db.insert(schema.contacts).values({ projectId: project.id, email: "ann@x.io" }).returning();
  const workflow = await workflows.create({ projectId: project.id, name: "W", status });
  return { projectId: project.id, contactId: contact.id, workflowId: workflow.id };
}

const graph = (event: string) => ({
  nodes: [
    { id: "t", type: "trigger", data: { event } },
    { id: "x", type: "exit", data: {} },
  ],
  edges: [{ id: "e", sourceNodeId: "t", targetNodeId: "x", sourceHandle: null }],
});

describe("workflow versions", () => {
  it("numbers versions per workflow and points the workflow at the latest", async () => {
    const { workflowId } = await seed();
    const v1 = await workflows.publishVersion(workflowId, graph("trial_started"));
    const v2 = await workflows.publishVersion(workflowId, graph("invoice_failed"), { kind: "lifecycle" });

    expect([v1.version, v2.version]).toEqual([1, 2]);
    expect(v2.settings).toEqual({ kind: "lifecycle" });
    expect(await workflows.getVersion(v1.id)).toMatchObject({ graph: graph("trial_started") });
    expect(await workflows.findById(workflowId)).toMatchObject({ activeVersionId: v2.id, triggerEvent: "invoice_failed" });
  });

  it("a trigger without an event leaves trigger_event empty", async () => {
    const { workflowId } = await seed();
    await workflows.publishVersion(workflowId, graph(""));
    expect(await workflows.findById(workflowId)).toMatchObject({ triggerEvent: null });
  });

  it("finds ACTIVE workflows of the project by trigger event", async () => {
    const a = await seed("ACTIVE");
    const paused = await seed("PAUSED");
    await workflows.publishVersion(a.workflowId, graph("x"));
    await workflows.publishVersion(paused.workflowId, graph("x"));

    expect((await workflows.findActiveByTrigger(a.projectId, "x")).map((w) => w.id)).toEqual([a.workflowId]);
    expect(await workflows.findActiveByTrigger(a.projectId, "y")).toEqual([]);
    expect(await workflows.findActiveByTrigger(paused.projectId, "x")).toEqual([]);
  });

  it("a run stores its version and exit reason", async () => {
    const { workflowId, contactId } = await seed();
    const v = await workflows.publishVersion(workflowId, graph("x"));
    const run = await executions.create({ workflowId, contactId, versionId: v.id, context: { steps: {} }, currentNodeId: "t" });
    await executions.finish(run!.id, { status: "COMPLETED", exitReason: "exit_node" });
    expect(await executions.findById(run!.id)).toMatchObject({ versionId: v.id, status: "COMPLETED", exitReason: "exit_node" });
  });
});

describe("db:upgrade-automations", () => {
  it("rewrites old step types and keys", () => {
    expect(normalizeNode({ type: "condition_api", data: { url: "u" } })).toEqual({ type: "condition", data: { url: "u", mode: "api" } });
    expect(normalizeNode({ type: "condition", data: { url: "u" } })).toEqual({ type: "condition", data: { url: "u", mode: "api" } });
    expect(normalizeNode({ type: "condition", data: { mode: "api" } })).toBeNull();
    expect(normalizeNode({ type: "action_email", data: { campaignId: 5 } })).toEqual({ type: "action", data: { triggerId: 5 } });
    expect(normalizeNode({ type: "action", data: { templateId: "7", label: "L" } })).toEqual({ type: "action", data: { triggerId: "7", label: "L" } });
    expect(normalizeNode({ type: "action", data: { triggerId: 1, campaignId: 2 } })).toEqual({ type: "action", data: { triggerId: 1 } });
    expect(normalizeNode({ type: "action", data: { triggerId: 1 } })).toBeNull();
    expect(normalizeNode({ type: "delay", data: {} })).toBeNull();
  });

  it("cancels runs from before versions, rewrites steps, publishes active workflows; a second run does nothing", async () => {
    const active = await seed("ACTIVE");
    const draft = await seed("DRAFT");
    await workflows.saveGraph(
      active.workflowId,
      [
        { id: "t", type: "trigger", data: { event: "x" } },
        { id: "c", type: "condition_api", data: { url: "https://x.io" } },
        { id: "m", type: "action_email", data: { campaignId: 5 } },
      ],
      [
        { id: "e1", sourceNodeId: "t", targetNodeId: "c", sourceHandle: null },
        { id: "e2", sourceNodeId: "c", targetNodeId: "m", sourceHandle: "yes" },
      ],
    );
    await workflows.saveGraph(draft.workflowId, [{ id: "t2", type: "trigger", data: { event: "y" } }], []);
    const [old] = await db
      .insert(schema.workflowExecutions)
      .values({ workflowId: active.workflowId, contactId: active.contactId, status: "RUNNING" })
      .returning();
    const [done] = await db
      .insert(schema.workflowExecutions)
      .values({ workflowId: active.workflowId, contactId: active.contactId, status: "COMPLETED" })
      .returning();

    const result = await upgradeAutomations(db);

    expect(result).toEqual({ cancelledRuns: 1, nodesRewritten: 2, versionsCreated: 1 });
    expect(await executions.findById(old.id)).toMatchObject({ status: "CANCELLED", exitReason: "upgrade" });
    expect(await executions.findById(done.id)).toMatchObject({ status: "COMPLETED" });

    const nodes = await workflows.getNodes(active.workflowId);
    expect(nodes.find((n) => n.id === "c")).toMatchObject({ type: "condition", data: { url: "https://x.io", mode: "api" } });
    expect(nodes.find((n) => n.id === "m")).toMatchObject({ type: "action", data: { triggerId: 5 } });

    const wf = await workflows.findById(active.workflowId);
    expect(wf).toMatchObject({ triggerEvent: "x" });
    const version = await workflows.getVersion(wf!.activeVersionId!);
    expect(version?.graph.nodes.map((n) => n.type)).toEqual(expect.arrayContaining(["trigger", "condition", "action"]));
    expect((await workflows.findById(draft.workflowId))?.activeVersionId).toBeNull();

    expect(await upgradeAutomations(db)).toEqual({ cancelledRuns: 0, nodesRewritten: 0, versionsCreated: 0 });
    const versions = await db.select().from(schema.workflowVersions).where(eq(schema.workflowVersions.workflowId, active.workflowId));
    expect(versions).toHaveLength(1);
  });
});
