import { describe, expect, it, vi } from "vitest";
import type { WorkflowEdge, WorkflowNode, WorkflowSettings, WorkflowVersion } from "../domain";
import type { Logger } from "../logger";
import { ServiceHooks } from "../hooks";
import { AutomationService, TEST_RUN_WAIT_CAP_MS, automationJobId } from "../services/automationService";
import { fakeExecutions } from "./fakes/executions";

const quiet = (): Logger => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
type Node = Omit<WorkflowNode, "workflowId">;
const edge = (from: string, to: string): Omit<WorkflowEdge, "workflowId"> => ({
  id: `${from}-${to}`,
  sourceNodeId: from,
  targetNodeId: to,
  sourceHandle: null,
});

/** "14 days without a login": trigger → wait 14 days → email. */
const nodes: Node[] = [
  { id: "t", type: "trigger", data: { event: "logged_in" } },
  { id: "wait", type: "delay", data: { duration: 14, unit: "days" } },
  { id: "mail", type: "action", data: { triggerId: 5 } },
];
const edges = [edge("t", "wait"), edge("wait", "mail")];

function setup({
  settings = {} as WorkflowSettings,
  graph = { nodes, edges },
  cap = undefined as { emails: number; days: number } | undefined,
  sentRecently = 0,
} = {}) {
  const version: WorkflowVersion = { id: 1, workflowId: 10, version: 1, graph, settings, createdAt: new Date() };
  const { repo: executions, runs, steps } = fakeExecutions();
  const queue = { add: vi.fn(async () => ({})) };
  const requireQuota = vi.fn(async () => {});
  const recordUsage = vi.fn(async () => {});
  const hooks = { requireQuota, recordUsage } as unknown as ServiceHooks;
  const trigger = { sendTriggeredEmail: vi.fn(async () => ({ logId: 77 })) };
  const countAutomationSends = vi.fn(async () => sentRecently);
  const service = new AutomationService(
    {
      findById: async () => ({ id: 10, projectId: 1, status: "ACTIVE", activeVersionId: 1 }),
      getVersion: async (id: number) => (id === 1 ? version : null),
    } as never,
    executions,
    { findById: async () => ({ id: 3, email: "ann@x.io", name: "Ann", locale: null, meta: {} }) } as never,
    { record: vi.fn(), existsSince: vi.fn(), listSince: vi.fn(async () => []) } as never,
    queue as never,
    trigger as never,
    quiet(),
    hooks,
    undefined,
    undefined,
    undefined,
    {
      projects: { findById: async () => ({ id: 1, automationSettings: cap ? { frequencyCap: cap } : {} }) } as never,
      sendCounts: { countAutomationSends },
    },
  );
  const login = (at: string) =>
    service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "logged_in", payload: { at } } });
  return { service, runs, steps, queue, requireQuota, recordUsage, trigger, countAutomationSends, login, version };
}

describe("restart entry (D4)", () => {
  it("a new trigger event moves the run back to the start with the new event: same run, not counted again", async () => {
    const { service, runs, queue, requireQuota, recordUsage, login } = setup({ settings: { entry: { mode: "restart" } } });
    const first = await login("mon");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "wait", generation: 0 });

    const again = await login("tue");
    expect(again!.id).toBe(first!.id);
    expect(runs.size).toBe(1);
    expect(runs.get(1)).toMatchObject({ currentNodeId: "wait", generation: 1, status: "RUNNING" });
    expect(runs.get(1)!.context.event).toEqual({ name: "logged_in", payload: { at: "tue" } });
    expect(requireQuota).toHaveBeenCalledTimes(1);
    expect(recordUsage).toHaveBeenCalledTimes(1);

    // The new pass has its own job id, so the first pass's delayed job does not stand in for it.
    expect(queue.add).toHaveBeenLastCalledWith(
      "workflow-1-wait",
      { executionId: 1, nodeId: "wait", generation: 1 },
      { delay: 14 * 86_400_000, jobId: "wf-1-g1-wait" },
    );

    // The first pass's job, when it fires, is dropped.
    await service.processStep(1, "wait", "https://app.test", undefined, 0);
    expect(runs.get(1)).toMatchObject({ currentNodeId: "wait" });
    await service.processStep(1, "wait", "https://app.test", undefined, 1);
    expect(runs.get(1)).toMatchObject({ currentNodeId: "mail" });
  });

  it("step rows and the email's dedupe key are per pass", async () => {
    const { service, steps, trigger, login } = setup({ settings: { entry: { mode: "restart" } } });
    await login("mon");
    await service.processStep(1, "wait", "https://app.test");
    // At the email step when the contact logs in again: back to the start.
    await login("tue");
    await service.processStep(1, "mail", "https://app.test");
    expect(trigger.sendTriggeredEmail).not.toHaveBeenCalled();

    await service.processStep(1, "wait", "https://app.test", undefined, 1);
    await service.processStep(1, "mail", "https://app.test", undefined, 1);
    expect(steps.get("1:wait")).toMatchObject({ status: "COMPLETED", generation: 0 });
    expect(steps.get("1:wait:g1")).toMatchObject({ status: "COMPLETED", generation: 1 });
    expect(steps.get("1:mail:g1")).toMatchObject({ status: "COMPLETED", generation: 1 });
    const keys = trigger.sendTriggeredEmail.mock.calls.map((c) => (c as unknown as [{ dedupeKey: string }])[0].dedupeKey);
    expect(keys).toEqual(["wf-1-g1-mail"]);
  });

  it("without restart a running contact is left alone", async () => {
    const { runs, login } = setup();
    await login("mon");
    await login("tue");
    expect(runs.get(1)).toMatchObject({ generation: 0 });
    expect(runs.get(1)!.context.event).toEqual({ name: "logged_in", payload: { at: "mon" } });
  });

  it("job ids of the first pass keep their old shape", () => {
    expect(automationJobId(1, "a")).toBe("wf-1-a");
    expect(automationJobId(1, "a", 2)).toBe("wf-1-g2-a");
  });
});

describe("test runs", () => {
  it("are not counted, skip delays, and do not block a real run", async () => {
    const { service, runs, queue, requireQuota, recordUsage, version, login } = setup();
    const test = await service.startTestRun({
      workflowId: 10,
      contactId: 3,
      version: { ...version, id: 1 },
      event: { name: "logged_in", payload: { at: "test" } },
    });
    expect(runs.get(test.id)).toMatchObject({ isTest: true, currentNodeId: "wait" });
    expect(queue.add).toHaveBeenLastCalledWith("workflow-1-wait", { executionId: 1, nodeId: "wait" }, { delay: 0, jobId: "wf-1-wait" });
    expect(requireQuota).not.toHaveBeenCalled();
    expect(recordUsage).not.toHaveBeenCalled();

    const real = await login("mon");
    expect(real!.id).not.toBe(test.id);
    expect(requireQuota).toHaveBeenCalledTimes(1);
  });

  it("cap a wait for an event at a minute", async () => {
    const graph = {
      nodes: [
        { id: "t", type: "trigger", data: { event: "x" } },
        { id: "w", type: "wait_event", data: { event: "y", timeout: { duration: 3, unit: "days" } } },
      ],
      edges: [edge("t", "w")],
    };
    const { service, queue, version } = setup({ graph });
    await service.startTestRun({ workflowId: 10, contactId: 3, version, event: { name: "x", payload: {} } });
    await service.processStep(1, "w", "https://app.test");
    expect(queue.add).toHaveBeenLastCalledWith(
      "workflow-1-w-timeout",
      { executionId: 1, nodeId: "w" },
      { delay: TEST_RUN_WAIT_CAP_MS, jobId: "wf-1-w-timeout" },
    );
  });
});

describe("frequency cap", () => {
  it("skips the email over the cap and goes on", async () => {
    const graph = { nodes: [...nodes.filter((n) => n.id !== "wait"), { id: "end", type: "exit", data: {} }], edges: [edge("t", "mail"), edge("mail", "end")] };
    const { service, runs, steps, trigger, countAutomationSends, login } = setup({ graph, cap: { emails: 2, days: 7 }, sentRecently: 2 });
    await login("mon");
    await service.processStep(1, "mail", "https://app.test");
    expect(trigger.sendTriggeredEmail).not.toHaveBeenCalled();
    expect(steps.get("1:mail")).toMatchObject({ status: "SKIPPED", result: { skipped: "frequency_cap" } });
    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "end" });
    const [projectId, email, since] = countAutomationSends.mock.calls[0] as unknown as [number, string, Date];
    expect([projectId, email]).toEqual([1, "ann@x.io"]);
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
  });

  it("sends under the cap, records the run on the send, and does not cap test runs", async () => {
    const graph = { nodes: nodes.filter((n) => n.id !== "wait"), edges: [edge("t", "mail")] };
    const under = setup({ graph, cap: { emails: 2, days: 7 }, sentRecently: 1 });
    await under.login("mon");
    await under.service.processStep(1, "mail", "https://app.test");
    expect(under.trigger.sendTriggeredEmail).toHaveBeenCalledWith(expect.objectContaining({ workflowExecutionId: 1 }));

    const test = setup({ graph, cap: { emails: 1, days: 7 }, sentRecently: 5 });
    await test.service.startTestRun({ workflowId: 10, contactId: 3, version: test.version, event: { name: "logged_in", payload: {} } });
    await test.service.processStep(1, "mail", "https://app.test");
    expect(test.trigger.sendTriggeredEmail).toHaveBeenCalledTimes(1);
    expect(test.countAutomationSends).not.toHaveBeenCalled();
  });
});

describe("step handler registry", () => {
  it("runs a registered handler for its node type; the engine moves the run on", async () => {
    const graph = {
      nodes: [
        { id: "t", type: "trigger", data: { event: "x" } },
        { id: "s", type: "send_sms", data: { text: "hi" } },
        { id: "end", type: "exit", data: {} },
      ],
      edges: [edge("t", "s"), edge("s", "end")],
    };
    const { service, runs, steps, login } = setup({ graph });
    const run = vi.fn(async () => ({ kind: "done" as const, output: { sid: "SM1" }, result: { sent: true } }));
    service.registerStepHandler({ type: "send_sms", recipient: "contact", run });
    await login("mon");
    await service.processStep(1, "s", "https://app.test");
    expect(run).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: "wf-1-s", node: expect.objectContaining({ id: "s" }) }));
    expect(steps.get("1:s")).toMatchObject({ status: "COMPLETED", result: { sent: true } });
    expect(runs.get(1)).toMatchObject({ currentNodeId: "end" });
    expect(runs.get(1)!.context.steps.s).toEqual({ sid: "SM1" });
  });

  it("an unknown step type fails the run", async () => {
    const graph = { nodes: [{ id: "t", type: "trigger", data: { event: "x" } }, { id: "s", type: "nope", data: {} }], edges: [edge("t", "s")] };
    const { service, runs, login } = setup({ graph });
    await login("mon");
    await service.processStep(1, "s", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
  });

  it("cancelRun ends one run", async () => {
    const { service, runs, login } = setup();
    await login("mon");
    expect(await service.cancelRun(1)).toBe(true);
    expect(runs.get(1)).toMatchObject({ status: "CANCELLED", exitReason: "cancelled_user" });
    expect(await service.cancelRun(1)).toBe(false);
  });
});
