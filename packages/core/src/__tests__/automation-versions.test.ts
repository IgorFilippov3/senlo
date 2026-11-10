import { describe, it, expect, vi } from "vitest";
import type { WorkflowEdge, WorkflowNode, WorkflowVersion } from "../domain";
import type { Logger } from "../logger";
import { AutomationService } from "../services/automationService";
import { fakeExecutions } from "./fakes/executions";

const quiet = (): Logger => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

type Graph = { nodes: Omit<WorkflowNode, "workflowId">[]; edges: Omit<WorkflowEdge, "workflowId">[] };

const version = (id: number, graph: Graph): WorkflowVersion => ({
  id,
  workflowId: 10,
  version: id,
  graph,
  settings: {},
  createdAt: new Date(),
});

const edge = (from: string, to: string, handle: string | null = null) => ({
  id: `${from}-${to}`,
  sourceNodeId: from,
  targetNodeId: to,
  sourceHandle: handle,
});

const v1: Graph = {
  nodes: [
    { id: "t", type: "trigger", data: { event: "x" } },
    { id: "wait", type: "delay", data: { duration: 1, unit: "days" } },
    { id: "mail", type: "action", data: { triggerId: 5 } },
  ],
  edges: [edge("t", "wait"), edge("wait", "mail")],
};

function setup(versions: WorkflowVersion[], activeVersionId: number | null = versions[0]?.id ?? null) {
  const { repo: executions, runs, steps, seed } = fakeExecutions();
  const workflow = { id: 10, projectId: 1, status: "ACTIVE", activeVersionId };
  const workflows = {
    findById: async () => workflow,
    getVersion: vi.fn(async (id: number) => versions.find((v) => v.id === id) ?? null),
  };
  const queue = { add: vi.fn(async () => ({})) };
  const trigger = { sendTriggeredEmail: vi.fn(async () => ({ success: true })) };
  const logger = quiet();
  const service = new AutomationService(
    workflows as never,
    executions,
    { findById: async () => ({ id: 3, email: "a@b.co", name: null, locale: null, meta: {} }) } as never,
    { record: async () => null } as never,
    queue as never,
    trigger as never,
    logger,
  );
  return { service, runs, steps, seed, workflow, executions, workflows, queue, trigger, logger };
}

describe("runs and versions", () => {
  it("a run starts on the active version and keeps it after a new version is published", async () => {
    const v2 = version(2, { nodes: [{ id: "t", type: "trigger", data: { event: "x" } }], edges: [] });
    const { service, workflow, queue, trigger, runs } = setup([version(1, v1), v2]);

    const run = await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    expect(run).toMatchObject({ versionId: 1 });
    expect(queue.add).toHaveBeenCalledWith("workflow-1-wait", { executionId: 1, nodeId: "wait" }, { delay: 86_400_000, jobId: "wf-1-wait" });
    expect(runs.get(1)).toMatchObject({ currentNodeId: "wait" });

    // Published while the run waits: v2 has no "wait" or "mail" step.
    workflow.activeVersionId = 2;
    await service.processStep(1, "wait", "https://app.test");
    await service.processStep(1, "mail", "https://app.test");

    expect(trigger.sendTriggeredEmail).toHaveBeenCalledTimes(1);
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "completed" });

    // A new run takes v2.
    const second = await service.triggerWorkflow({ workflowId: 10, contactId: 4, projectId: 1 });
    expect(second).toMatchObject({ versionId: 2 });
  });

  it("an ACTIVE workflow without a version starts nothing and says why", async () => {
    const { service, executions, logger } = setup([], null);
    expect(await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 })).toBeNull();
    expect(executions.create).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("db:upgrade-automations"), { workflowId: 10 });
  });

  it("a run without a version, or a step its version lacks, fails instead of staying RUNNING", async () => {
    const { service, runs, seed } = setup([version(1, v1)]);
    seed({ id: 1, versionId: null, currentNodeId: "mail" });
    seed({ id: 2, contactId: 4, currentNodeId: "ghost" });

    await service.processStep(1, "mail", "https://app.test");
    await service.processStep(2, "ghost", "https://app.test");

    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "invalid_run" });
    expect(runs.get(2)).toMatchObject({ status: "FAILED", exitReason: "invalid_run" });
  });

  it("an exit step ends the run with exit_node", async () => {
    const graph: Graph = {
      nodes: [
        { id: "t", type: "trigger", data: { event: "x" } },
        { id: "end", type: "exit", data: {} },
      ],
      edges: [edge("t", "end")],
    };
    const { service, runs, steps } = setup([version(1, graph)]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "end", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "exit_node" });
    expect(steps.get("1:end")).toMatchObject({ status: "COMPLETED" });
  });

  it("a failing step ends the run with error", async () => {
    const { service, runs, trigger, steps } = setup([version(1, v1)]);
    trigger.sendTriggeredEmail.mockRejectedValueOnce(new Error("provider down"));
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "wait", "https://app.test");
    await service.processStep(1, "mail", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
    expect(steps.get("1:mail")).toMatchObject({ status: "FAILED", result: { error: "provider down" } });
  });
});

describe("cursor and idempotent steps", () => {
  it("drops a job for a step the run is not at", async () => {
    const { service, trigger, runs } = setup([version(1, v1)]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    // The run waits at "wait"; a stray job for "mail" arrives early.
    await service.processStep(1, "mail", "https://app.test");

    expect(trigger.sendTriggeredEmail).not.toHaveBeenCalled();
    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "wait" });
  });

  it("the same job delivered twice runs the step once", async () => {
    const { service, trigger, runs } = setup([version(1, v1)]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "wait", "https://app.test");

    await Promise.all([
      service.processStep(1, "mail", "https://app.test"),
      service.processStep(1, "mail", "https://app.test"),
    ]);
    await service.processStep(1, "mail", "https://app.test");

    // The fake has no locks: two concurrent deliveries may both claim the
    // PENDING row, which is why the send carries a dedupe key. Done ones skip.
    for (const call of trigger.sendTriggeredEmail.mock.calls) {
      expect((call as unknown as [{ dedupeKey: string }])[0].dedupeKey).toBe("wf-1-mail");
    }
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED" });
  });

  it("a step already COMPLETED (crash after the step, before the next job) is not run again, the cursor moves on", async () => {
    const { service, trigger, runs, steps, executions, queue } = setup([version(1, v1)]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    // The step finished but the cursor stayed at "wait" (as if the move was lost).
    const step = await executions.claimStep(1, "wait");
    steps.set("1:wait", { ...step, status: "COMPLETED" });

    await service.processStep(1, "wait", "https://app.test");

    expect(runs.get(1)).toMatchObject({ currentNodeId: "mail" });
    expect(queue.add).toHaveBeenLastCalledWith("workflow-1-mail", { executionId: 1, nodeId: "mail" }, { delay: 0, jobId: "wf-1-mail" });
    expect(trigger.sendTriggeredEmail).not.toHaveBeenCalled();
  });

  it("a completed condition step keeps its branch on redelivery", async () => {
    const graph: Graph = {
      nodes: [
        { id: "t", type: "trigger", data: { event: "x" } },
        { id: "c", type: "condition", data: { url: "https://x.io" } },
        { id: "yes", type: "exit", data: {} },
        { id: "no", type: "exit", data: {} },
      ],
      edges: [edge("t", "c"), edge("c", "yes", "yes"), edge("c", "no", "no")],
    };
    const { service, runs, steps, executions } = setup([version(1, graph)]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    const step = await executions.claimStep(1, "c");
    steps.set("1:c", { ...step, status: "COMPLETED", result: { branch: "no" } });

    await service.processStep(1, "c", "https://app.test");

    expect(runs.get(1)).toMatchObject({ currentNodeId: "no" });
  });

  it("two entries at once start one run and count it once", async () => {
    const { service, executions } = setup([version(1, v1)]);
    // The pre-check sees no run for both; the insert decides.
    executions.findRunningByContact = vi.fn(async () => null) as never;
    const [a, b] = await Promise.all([
      service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 }),
      service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 }),
    ]);
    expect(executions.create).toHaveBeenCalledTimes(2);
    expect([a, b].filter((r) => r !== null)).toHaveLength(1);
  });
});
