import { describe, it, expect, vi } from "vitest";
import type { WorkflowEdge, WorkflowExecution, WorkflowNode, WorkflowVersion } from "../domain";
import type { Logger } from "../logger";
import { AutomationService } from "../services/automationService";

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

const v1: Graph = {
  nodes: [
    { id: "t", type: "trigger", data: { event: "x" } },
    { id: "wait", type: "delay", data: { duration: 1, unit: "days" } },
    { id: "mail", type: "action", data: { triggerId: 5 } },
  ],
  edges: [
    { id: "e1", sourceNodeId: "t", targetNodeId: "wait", sourceHandle: null },
    { id: "e2", sourceNodeId: "wait", targetNodeId: "mail", sourceHandle: null },
  ],
};

function setup(versions: WorkflowVersion[], activeVersionId: number | null = versions[0]?.id ?? null) {
  const runs = new Map<number, WorkflowExecution>();
  const workflow = { id: 10, projectId: 1, status: "ACTIVE", activeVersionId };
  const executions = {
    findRunningByContact: async () => null,
    create: vi.fn(async (d: Omit<WorkflowExecution, "id" | "startedAt">) => {
      const run = { ...d, id: runs.size + 1, startedAt: new Date() } as WorkflowExecution;
      runs.set(run.id, run);
      return run;
    }),
    findById: async (id: number) => runs.get(id) ?? null,
    updateStatus: vi.fn(async (id: number, status: WorkflowExecution["status"], _at?: Date, exitReason?: string) => {
      const run = runs.get(id);
      if (run) runs.set(id, { ...run, status, exitReason });
    }),
    createStepExecution: vi.fn(async () => ({ id: 1 })),
    updateStepExecution: vi.fn(async () => {}),
  };
  const workflows = {
    findById: async () => workflow,
    getVersion: vi.fn(async (id: number) => versions.find((v) => v.id === id) ?? null),
  };
  const queue = { add: vi.fn(async () => ({})) };
  const trigger = { sendTriggeredEmail: vi.fn(async () => ({ success: true })) };
  const logger = quiet();
  const service = new AutomationService(
    workflows as never,
    executions as never,
    { findById: async () => ({ id: 3, email: "a@b.co", name: null, locale: null, meta: {} }) } as never,
    { record: async () => null } as never,
    queue as never,
    trigger as never,
    logger,
  );
  return { service, runs, workflow, executions, workflows, queue, trigger, logger };
}

describe("runs and versions", () => {
  it("a run starts on the active version and keeps it after a new version is published", async () => {
    const v2 = version(2, { nodes: [{ id: "t", type: "trigger", data: { event: "x" } }], edges: [] });
    const { service, workflow, queue, trigger, runs } = setup([version(1, v1), v2]);

    const run = await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    expect(run).toMatchObject({ versionId: 1 });
    expect(queue.add).toHaveBeenCalledWith("workflow-1-wait", { executionId: 1, nodeId: "wait" }, { delay: 86_400_000 });

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
    const { service, runs } = setup([version(1, v1)]);
    runs.set(1, { id: 1, workflowId: 10, contactId: 3, status: "RUNNING", versionId: null, context: { steps: {} }, startedAt: new Date() });
    runs.set(2, { id: 2, workflowId: 10, contactId: 4, status: "RUNNING", versionId: 1, context: { steps: {} }, startedAt: new Date() });

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
      edges: [{ id: "e", sourceNodeId: "t", targetNodeId: "end", sourceHandle: null }],
    };
    const { service, runs } = setup([version(1, graph)]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "end", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "exit_node" });
  });

  it("a failing step ends the run with error", async () => {
    const { service, runs, trigger } = setup([version(1, v1)]);
    trigger.sendTriggeredEmail.mockRejectedValueOnce(new Error("provider down"));
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "mail", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
  });
});
