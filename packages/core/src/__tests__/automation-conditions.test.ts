import { describe, it, expect, vi } from "vitest";
import type { WorkflowEdge, WorkflowNode, WorkflowVersion } from "../domain";
import type { Logger } from "../logger";
import { AutomationService } from "../services/automationService";
import { fakeExecutions } from "./fakes/executions";

const quiet = (): Logger => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });
type Node = Omit<WorkflowNode, "workflowId">;
const edge = (from: string, to: string, handle: string | null = null): Omit<WorkflowEdge, "workflowId"> => ({
  id: `${from}-${to}`,
  sourceNodeId: from,
  targetNodeId: to,
  sourceHandle: handle,
});
const DAY = 24 * 60 * 60 * 1000;

function setup(nodes: Node[], edges: Omit<WorkflowEdge, "workflowId">[], { meta = {} as Record<string, unknown>, history = [] as Array<{ name: string; at: Date }> } = {}) {
  const version: WorkflowVersion = { id: 1, workflowId: 10, version: 1, graph: { nodes, edges }, settings: {}, createdAt: new Date() };
  const { repo: executions, runs, steps } = fakeExecutions();
  const workflow = { id: 10, projectId: 1, status: "ACTIVE", activeVersionId: 1, triggerEvent: "x" };
  const workflows = {
    findById: async () => workflow,
    getVersion: async () => version,
    findActiveByTrigger: async (_p: number, name: string) => (name === workflow.triggerEvent ? [workflow] : []),
  };
  const contact = { id: 3, email: "a@b.co", name: "Ann", locale: "en", unsubscribed: false, meta };
  const contactEvents = {
    record: vi.fn(async (d: { name: string; payload: Record<string, unknown> }) => ({ id: 1, ...d })),
    existsSince: vi.fn(async (_c: number, name: string, since: Date) => history.some((h) => h.name === name && h.at >= since)),
  };
  const queue = { add: vi.fn(async () => ({})) };
  const service = new AutomationService(
    workflows as never,
    executions,
    { findById: async () => contact } as never,
    contactEvents as never,
    queue as never,
    { sendTriggeredEmail: vi.fn(async () => ({})) } as never,
    quiet(),
  );
  return { service, runs, steps, queue, contactEvents, contact };
}

const trigger = (data: Record<string, unknown> = { event: "x" }): Node => ({ id: "t", type: "trigger", data });
const exits: Node[] = [
  { id: "yes", type: "exit", data: {} },
  { id: "no", type: "exit", data: {} },
];
const branches = (from: string) => [edge(from, "yes", "yes"), edge(from, "no", "no")];

describe("Condition in rules mode", () => {
  it("a win-back flow branches on the event's reason", async () => {
    const c: Node = {
      id: "c",
      type: "condition",
      data: { mode: "rules", conditions: { op: "and", rules: [{ source: "event", path: "reason", operator: "eq", value: "too_expensive" }] } },
    };
    for (const [reason, expected] of [["too_expensive", "yes"], ["missing_feature", "no"]] as const) {
      const { service, runs, steps } = setup([trigger(), c, ...exits], [edge("t", "c"), ...branches("c")]);
      await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "x", payload: { reason } } });
      await service.processStep(1, "c", "https://app.test");
      expect(runs.get(1)).toMatchObject({ currentNodeId: expected });
      expect(steps.get("1:c")).toMatchObject({ status: "COMPLETED", result: { branch: expected, matched: expected === "yes" } });
    }
  });

  it("an activation flow branches on 'has not done project_created in 3 days'", async () => {
    const c: Node = {
      id: "c",
      type: "condition",
      data: { mode: "rules", conditions: { op: "and", rules: [{ source: "history", event: "project_created", did: false, withinDays: 3 }] } },
    };
    const recent = setup([trigger(), c, ...exits], [edge("t", "c"), ...branches("c")], {
      history: [{ name: "project_created", at: new Date(Date.now() - DAY) }],
    });
    await recent.service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await recent.service.processStep(1, "c", "https://app.test");
    expect(recent.runs.get(1)).toMatchObject({ currentNodeId: "no" });
    expect(recent.contactEvents.existsSince).toHaveBeenCalledWith(3, "project_created", expect.any(Date));

    const old = setup([trigger(), c, ...exits], [edge("t", "c"), ...branches("c")], {
      history: [{ name: "project_created", at: new Date(Date.now() - 5 * DAY) }],
    });
    await old.service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await old.service.processStep(1, "c", "https://app.test");
    expect(old.runs.get(1)).toMatchObject({ currentNodeId: "yes" });
  });

  it("a condition without a mode fails the step", async () => {
    const { service, runs } = setup([trigger(), { id: "c", type: "condition", data: {} }, ...exits], [edge("t", "c"), ...branches("c")]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "c", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
  });
});

describe("Wait until", () => {
  const until = (data: Record<string, unknown>): Node => ({ id: "w", type: "delay", data: { mode: "until", ...data } });
  const graph = (w: Node) => [[trigger(), w, { id: "end", type: "exit", data: {} }], [edge("t", "w"), edge("w", "end")]] as const;

  it("a trial flow waits until the event's trial_ends_at minus 3 days", async () => {
    const endsAt = new Date(Date.now() + 10 * DAY);
    const [nodes, edges] = graph(until({ until: { source: "event", path: "trial_ends_at", offset: { duration: 3, unit: "days", direction: "before" } } }));
    const { service, queue, runs, steps } = setup([...nodes], [...edges]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "x", payload: { trial_ends_at: endsAt.toISOString() } } });

    const [, , opts] = queue.add.mock.calls.at(-1) as unknown as [string, unknown, { delay: number }];
    expect(opts.delay).toBeGreaterThan(7 * DAY - 60_000);
    expect(opts.delay).toBeLessThanOrEqual(7 * DAY);
    expect(Math.abs(runs.get(1)!.wakeAt!.getTime() - (endsAt.getTime() - 3 * DAY))).toBeLessThan(60_000);

    await service.processStep(1, "w", "https://app.test");
    expect(steps.get("1:w")).toMatchObject({ status: "COMPLETED", result: { until: new Date(endsAt.getTime() - 3 * DAY).toISOString() } });
  });

  it("a date in the past continues at once", async () => {
    const [nodes, edges] = graph(until({ until: { source: "contact", path: "renews_at" } }));
    const { service, queue } = setup([...nodes], [...edges], { meta: { renews_at: "2020-01-01" } });
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    expect((queue.add.mock.calls.at(-1) as unknown as [string, unknown, { delay: number }])[2].delay).toBe(0);
  });

  it("a missing or unreadable date fails the step, or skips it with onError: continue", async () => {
    for (const payload of [{}, { trial_ends_at: "soon" }]) {
      const [nodes, edges] = graph(until({ until: { source: "event", path: "trial_ends_at" } }));
      const { service, runs } = setup([...nodes], [...edges]);
      await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "x", payload } });
      await service.processStep(1, "w", "https://app.test");
      expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
    }

    const [nodes, edges] = graph(until({ until: { source: "event", path: "trial_ends_at" }, onError: "continue" }));
    const { service, runs, steps } = setup([...nodes], [...edges]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "x", payload: {} } });
    await service.processStep(1, "w", "https://app.test");
    expect(steps.get("1:w")).toMatchObject({ status: "SKIPPED" });
    expect(runs.get(1)).toMatchObject({ currentNodeId: "end" });
  });

  it("a plain wait is unchanged", async () => {
    const [nodes, edges] = graph({ id: "w", type: "delay", data: { duration: 2, unit: "hours" } });
    const { service, queue } = setup([...nodes], [...edges]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    expect((queue.add.mock.calls.at(-1) as unknown as [string, unknown, { delay: number }])[2].delay).toBe(2 * 60 * 60 * 1000);
  });
});

describe("trigger filters", () => {
  it("start the run only when the contact and the event pass them", async () => {
    const filtered = trigger({
      event: "x",
      filters: {
        op: "and",
        rules: [
          { source: "contact", path: "plan", operator: "eq", value: "pro" },
          { source: "event", path: "amount", operator: "gte", value: 100 },
        ],
      },
    });
    const pro = setup([filtered, { id: "end", type: "exit", data: {} }], [edge("t", "end")], { meta: { plan: "pro" } });
    await pro.service.handleEvent({ projectId: 1, contactId: 3, name: "x", payload: { amount: 50 } });
    expect(pro.runs.size).toBe(0);
    await pro.service.handleEvent({ projectId: 1, contactId: 3, name: "x", payload: { amount: 150 } });
    expect(pro.runs.size).toBe(1);

    const free = setup([filtered, { id: "end", type: "exit", data: {} }], [edge("t", "end")], { meta: { plan: "free" } });
    await free.service.handleEvent({ projectId: 1, contactId: 3, name: "x", payload: { amount: 150 } });
    expect(free.runs.size).toBe(0);
  });
});
