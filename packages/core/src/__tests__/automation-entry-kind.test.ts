import { describe, it, expect, vi } from "vitest";
import type { WorkflowEdge, WorkflowNode, WorkflowSettings, WorkflowVersion } from "../domain";
import type { Logger } from "../logger";
import { AutomationService } from "../services/automationService";
import { fakeExecutions } from "./fakes/executions";

const quiet = (): Logger => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
type Node = Omit<WorkflowNode, "workflowId">;
const edge = (from: string, to: string): Omit<WorkflowEdge, "workflowId"> => ({ id: `${from}-${to}`, sourceNodeId: from, targetNodeId: to, sourceHandle: null });

const nodes: Node[] = [
  { id: "t", type: "trigger", data: { event: "x" } },
  { id: "m", type: "action", data: { triggerId: 5 } },
  { id: "d", type: "delay", data: { duration: 1, unit: "days" } },
];
const edges = [edge("t", "m"), edge("m", "d")];

function setup(settings: WorkflowSettings = {}, { blocked = null as null | "UNSUBSCRIBE" | "BOUNCE" | "SPAM" } = {}) {
  const version: WorkflowVersion = { id: 1, workflowId: 10, version: 1, graph: { nodes, edges }, settings, createdAt: new Date() };
  const { repo: executions, runs, steps } = fakeExecutions({ lifecycleVersions: settings.kind === "lifecycle" ? [1] : [] });
  const block = { reason: blocked };
  const trigger = { sendTriggeredEmail: vi.fn(async () => ({ logId: 1 })) };
  const service = new AutomationService(
    { findById: async () => ({ id: 10, projectId: 1, status: "ACTIVE", activeVersionId: 1 }), getVersion: async () => version } as never,
    executions,
    {
      findById: async (id: number) => ({ id, email: `c${id}@x.io`, name: null, locale: null, meta: {} }),
      findByEmail: async (_p: number, email: string) => ({ id: Number(email.slice(1, email.indexOf("@"))), email }),
    } as never,
    { record: async () => null } as never,
    { add: vi.fn(async () => ({})) } as never,
    trigger as never,
    quiet(),
    undefined,
    undefined,
    undefined,
    { findSendBlock: vi.fn(async () => (block.reason ? { reason: block.reason } : null)) },
  );
  const start = (contactId = 3) => service.triggerWorkflow({ workflowId: 10, contactId, projectId: 1 });
  const end = (id: number) => runs.set(id, { ...runs.get(id)!, status: "COMPLETED" });
  return { service, runs, steps, trigger, start, end, block };
}

describe("entry rules", () => {
  it("after_exit (default): again once the previous run ended", async () => {
    const { start, end, runs } = setup();
    await start();
    end(1);
    await start();
    expect(runs.size).toBe(2);
  });

  it("once: never a second run for the contact", async () => {
    const { start, end, runs } = setup({ entry: { mode: "once" } });
    await start();
    end(1);
    expect(await start()).toBeNull();
    await start(4);
    expect(runs.size).toBe(2);
  });

  it("cooldown: not again within the window after the last start", async () => {
    const { start, end, runs } = setup({ entry: { mode: "after_exit", cooldown: { duration: 7, unit: "days" } } });
    await start();
    end(1);
    expect(await start()).toBeNull();

    runs.set(1, { ...runs.get(1)!, startedAt: new Date(Date.now() - 8 * 86_400_000) });
    expect(await start()).not.toBeNull();
  });
});

describe("kind and blocked contacts", () => {
  it("transactional: a blocked contact's email step is SKIPPED and the run goes on", async () => {
    const { service, runs, steps, trigger } = setup({}, { blocked: "UNSUBSCRIBE" });
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "m", "https://app.test");
    expect(trigger.sendTriggeredEmail).not.toHaveBeenCalled();
    expect(steps.get("1:m")).toMatchObject({ status: "SKIPPED", result: { skipped: "UNSUBSCRIBE" } });
    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "d" });
  });

  it("lifecycle: a contact blocked mid-run ends the run at the email step", async () => {
    const { service, runs, steps, block } = setup({ kind: "lifecycle" });
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    block.reason = "BOUNCE";
    await service.processStep(1, "m", "https://app.test");
    expect(steps.get("1:m")).toMatchObject({ status: "SKIPPED" });
    expect(runs.get(1)).toMatchObject({ status: "CANCELLED", exitReason: "suppressed" });
  });

  it("lifecycle: a blocked contact does not start", async () => {
    const { start, runs } = setup({ kind: "lifecycle" }, { blocked: "UNSUBSCRIBE" });
    expect(await start()).toBeNull();
    expect(runs.size).toBe(0);
  });

  it("unsubscribing ends lifecycle runs at once, transactional ones go on", async () => {
    const lifecycle = setup({ kind: "lifecycle" });
    await lifecycle.start();
    await lifecycle.service.onContactBlocked({ projectId: 1, email: "c3@x.io", reason: "UNSUBSCRIBE" });
    expect(lifecycle.runs.get(1)).toMatchObject({ status: "CANCELLED", exitReason: "unsubscribed" });

    const transactional = setup();
    await transactional.start();
    await transactional.service.onContactBlocked({ projectId: 1, email: "c3@x.io", reason: "SPAM" });
    expect(transactional.runs.get(1)).toMatchObject({ status: "RUNNING" });
  });
});
