import { describe, it, expect, vi } from "vitest";
import type { ContactEvent, WorkflowEdge, WorkflowNode, WorkflowSettings, WorkflowVersion } from "../domain";
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

interface Flow {
  id: number;
  trigger: string;
  nodes: Node[];
  edges: Omit<WorkflowEdge, "workflowId">[];
  settings?: WorkflowSettings;
}

/** Several workflows in project 1, one contact (3), a real-ish event log. */
function setup(flows: Flow[], { meta = {} as Record<string, unknown> } = {}) {
  const versions = new Map<number, WorkflowVersion>(
    flows.map((f) => [f.id, { id: f.id, workflowId: f.id, version: 1, graph: { nodes: f.nodes, edges: f.edges }, settings: f.settings ?? {}, createdAt: new Date() }]),
  );
  const workflows = new Map(flows.map((f) => [f.id, { id: f.id, projectId: 1, status: "ACTIVE", activeVersionId: f.id, triggerEvent: f.trigger }]));
  const { repo: executions, runs, steps } = fakeExecutions();
  const log: ContactEvent[] = [];
  const contactEvents = {
    record: vi.fn(async (d: { projectId: number; contactId: number; name: string; payload: Record<string, unknown> }) => {
      const e: ContactEvent = { ...d, id: log.length + 1, idempotencyKey: null, createdAt: new Date() };
      log.push(e);
      return e;
    }),
    existsSince: vi.fn(async () => false),
    listSince: vi.fn(async (contactId: number, name: string, since: Date) =>
      log.filter((e) => e.contactId === contactId && e.name === name && e.createdAt >= since).reverse(),
    ),
  };
  const queue = { add: vi.fn(async () => ({})) };
  const service = new AutomationService(
    {
      findById: async (id: number) => workflows.get(id) ?? null,
      getVersion: async (id: number) => versions.get(id) ?? null,
      findActiveByTrigger: async (_p: number, name: string) => [...workflows.values()].filter((w) => w.triggerEvent === name),
    } as never,
    executions,
    { findById: async () => ({ id: 3, email: "a@b.co", name: null, locale: null, meta }) } as never,
    contactEvents,
    queue as never,
    { sendTriggeredEmail: vi.fn(async () => ({ logId: 1 })) } as never,
    quiet(),
  );
  const send = (name: string, payload: Record<string, unknown> = {}) => service.handleEvent({ projectId: 1, contactId: 3, name, payload });
  return { service, runs, steps, queue, log, send, executions };
}

const exits: Node[] = [
  { id: "yes", type: "exit", data: {} },
  { id: "no", type: "exit", data: {} },
];
const waitFlow = (data: Record<string, unknown> = {}): Flow => ({
  id: 1,
  trigger: "signed_up",
  nodes: [
    { id: "t", type: "trigger", data: { event: "signed_up" } },
    { id: "w", type: "wait_event", data: { event: "project_created", timeout: { duration: 3, unit: "days" }, ...data } },
    ...exits,
  ],
  edges: [edge("t", "w"), edge("w", "yes", "yes"), edge("w", "no", "no")],
});

describe("Wait for event", () => {
  it("the contact did it already (since the run started): Yes at once, with the event's payload as the step output", async () => {
    const { service, runs, steps, send } = setup([waitFlow()]);
    await send("signed_up");
    await send("project_created", { name: "Acme" });
    await service.processStep(1, "w", "https://app.test");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "yes", waitingEvent: null });
    expect(runs.get(1)!.context.steps.w).toEqual({ name: "Acme" });
    expect(steps.get("1:w")).toMatchObject({ status: "COMPLETED", result: { branch: "yes", eventId: 2 } });
  });

  it("waits, then the event arrives: Yes; the timeout job later does nothing", async () => {
    const { service, runs, queue, send } = setup([waitFlow()]);
    await send("signed_up");
    await service.processStep(1, "w", "https://app.test");

    expect(runs.get(1)).toMatchObject({ currentNodeId: "w", waitingEvent: "project_created" });
    expect(queue.add).toHaveBeenLastCalledWith("workflow-1-w-timeout", { executionId: 1, nodeId: "w" }, { delay: 3 * 86_400_000, jobId: "wf-1-w-timeout" });

    await send("project_created", { name: "Acme" });
    expect(runs.get(1)).toMatchObject({ currentNodeId: "yes", waitingEvent: null });
    expect(runs.get(1)!.context.steps.w).toEqual({ name: "Acme" });

    await service.processStep(1, "w", "https://app.test");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "yes" });
  });

  it("times out: No; an event after that changes nothing", async () => {
    const { service, runs, steps, send } = setup([waitFlow()]);
    await send("signed_up");
    await service.processStep(1, "w", "https://app.test");

    // The timeout job, when it is due.
    runs.set(1, { ...runs.get(1)!, wakeAt: new Date(Date.now() - 1000) });
    await service.processStep(1, "w", "https://app.test");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "no", waitingEvent: null });
    expect(steps.get("1:w")).toMatchObject({ result: { branch: "no", timedOut: true } });

    await send("project_created");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "no" });
  });

  it("an early copy of the job keeps waiting", async () => {
    const { service, runs, send } = setup([waitFlow()]);
    await send("signed_up");
    await service.processStep(1, "w", "https://app.test");
    await service.processStep(1, "w", "https://app.test");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "w", waitingEvent: "project_created" });
  });

  it("the event and the timeout racing: one branch only", async () => {
    const { service, runs, send, executions } = setup([waitFlow()]);
    await send("signed_up");
    await service.processStep(1, "w", "https://app.test");
    runs.set(1, { ...runs.get(1)!, wakeAt: new Date(Date.now() - 1000) });

    await Promise.all([send("project_created"), service.processStep(1, "w", "https://app.test")]);

    const resolved = await Promise.all(executions.resolveWait.mock.results.map((r) => r.value));
    expect(resolved.filter(Boolean)).toHaveLength(1);
    expect(["yes", "no"]).toContain(runs.get(1)!.currentNodeId);
  });

  it("filters on the waited event", async () => {
    const filters = { op: "and", rules: [{ source: "event", path: "plan", operator: "eq", value: "pro" }] };
    const { service, runs, send } = setup([waitFlow({ event: "upgraded", filters })]);
    await send("signed_up");
    await service.processStep(1, "w", "https://app.test");
    await send("upgraded", { plan: "starter" });
    expect(runs.get(1)).toMatchObject({ currentNodeId: "w" });
    await send("upgraded", { plan: "pro" });
    expect(runs.get(1)).toMatchObject({ currentNodeId: "yes" });
  });

  it("a step that cannot run (no event) takes No with onError: continue", async () => {
    const { service, runs, steps, send } = setup([waitFlow({ event: "", onError: "continue" })]);
    await send("signed_up");
    await service.processStep(1, "w", "https://app.test");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "no" });
    expect(steps.get("1:w")).toMatchObject({ status: "COMPLETED", result: { branch: "no" } });
  });

  it("since the step started: an event before the step does not count", async () => {
    const { service, runs, steps, send, executions } = setup([waitFlow({ since: "step_start" })]);
    await send("signed_up");
    await send("project_created");
    // The step starts after that event.
    const step = await executions.claimStep(1, "w");
    steps.set("1:w", { ...step, startedAt: new Date(Date.now() + 1000) });
    await service.processStep(1, "w", "https://app.test");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "w", waitingEvent: "project_created" });
  });
});

describe("goals", () => {
  const dunning: Flow = {
    id: 1,
    trigger: "payment_failed",
    nodes: [
      { id: "t", type: "trigger", data: { event: "payment_failed" } },
      { id: "d", type: "delay", data: { duration: 2, unit: "days" } },
      { id: "m", type: "action", data: { triggerId: 5 } },
    ],
    edges: [edge("t", "d"), edge("d", "m")],
    settings: { goal: { event: "payment_succeeded" } },
  };

  it("the goal event ends a run sitting in a delay, and its next step does not run", async () => {
    const { service, runs, send } = setup([dunning]);
    await send("payment_failed");
    expect(runs.get(1)).toMatchObject({ currentNodeId: "d", goalEvent: "payment_succeeded" });

    await send("payment_succeeded");
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "goal" });

    await service.processStep(1, "d", "https://app.test");
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "goal" });
  });

  it("goal filters", async () => {
    const flow = { ...dunning, settings: { goal: { event: "payment_succeeded", filters: { op: "and" as const, rules: [{ source: "event" as const, path: "invoice", operator: "eq" as const, value: "in_1" }] } } } };
    const { runs, send } = setup([flow]);
    await send("payment_failed");
    await send("payment_succeeded", { invoice: "in_2" });
    expect(runs.get(1)).toMatchObject({ status: "RUNNING" });
    await send("payment_succeeded", { invoice: "in_1" });
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "goal" });
  });

  it("the event that ends one run can start another workflow", async () => {
    const thanks: Flow = {
      id: 2,
      trigger: "payment_succeeded",
      nodes: [{ id: "t2", type: "trigger", data: { event: "payment_succeeded" } }, { id: "d2", type: "delay", data: { duration: 1, unit: "hours" } }],
      edges: [edge("t2", "d2")],
    };
    const { runs, send } = setup([dunning, thanks]);
    await send("payment_failed");
    await send("payment_succeeded");
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "goal" });
    expect(runs.get(2)).toMatchObject({ workflowId: 2, status: "RUNNING" });
  });

  it("a goal also ends a run waiting for an event", async () => {
    const flow = { ...waitFlow(), settings: { goal: { event: "upgraded" } } };
    const { service, runs, send } = setup([flow]);
    await send("signed_up");
    await service.processStep(1, "w", "https://app.test");
    await send("upgraded");
    expect(runs.get(1)).toMatchObject({ status: "COMPLETED", exitReason: "goal", waitingEvent: null });
  });
});
