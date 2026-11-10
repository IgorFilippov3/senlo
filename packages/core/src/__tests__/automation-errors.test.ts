import { afterEach, describe, it, expect, vi } from "vitest";
import type { WorkflowEdge, WorkflowNode, WorkflowVersion } from "../domain";
import { NotFoundError, QuotaExceededError, RetryableStepError } from "../errors";
import type { Logger } from "../logger";
import type { OutboundPolicy } from "../outbound";
import { AutomationService } from "../services/automationService";
import { AutomationWorkerProcessor } from "../queue/worker";
import { fakeExecutions } from "./fakes/executions";

const quiet = (): Logger => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

type Node = Omit<WorkflowNode, "workflowId">;
const edge = (from: string, to: string, handle: string | null = null): Omit<WorkflowEdge, "workflowId"> => ({
  id: `${from}-${to}`,
  sourceNodeId: from,
  targetNodeId: to,
  sourceHandle: handle,
});

/** trigger -> step -> (yes|next) end, (no) other end */
function graphWith(step: Node) {
  const nodes: Node[] = [
    { id: "t", type: "trigger", data: { event: "x" } },
    step,
    { id: "yes", type: "exit", data: {} },
    { id: "no", type: "exit", data: {} },
  ];
  const edges =
    step.type === "condition"
      ? [edge("t", step.id), edge(step.id, "yes", "yes"), edge(step.id, "no", "no")]
      : [edge("t", step.id), edge(step.id, "yes")];
  return { nodes, edges };
}

function setup(step: Node, { outbound }: { outbound?: OutboundPolicy } = {}) {
  const version: WorkflowVersion = { id: 1, workflowId: 10, version: 1, graph: graphWith(step), settings: {}, createdAt: new Date() };
  const { repo: executions, runs, steps } = fakeExecutions();
  const workflows = {
    findById: async (id: number) => (id === 10 ? { id: 10, projectId: 1, status: "ACTIVE", activeVersionId: 1 } : null),
    getVersion: async () => version,
  };
  const contacts = {
    findById: async () => ({ id: 3, email: "a@b.co", name: null, locale: null, meta: {} }),
    findByEmail: async (projectId: number, email: string) => (projectId === 1 && email === "a@b.co" ? { id: 3 } : null),
    update: vi.fn(async () => null),
  };
  const queue = {
    add: vi.fn(async () => ({})),
    getJob: vi.fn(async (_id: string) => null as null | { getState: () => Promise<string>; remove: () => Promise<void> }),
  };
  const trigger = { sendTriggeredEmail: vi.fn(async () => ({ success: true })) };
  const logger = quiet();
  const service = new AutomationService(
    workflows as never,
    executions,
    contacts as never,
    { record: async () => null } as never,
    queue as never,
    trigger as never,
    logger,
    undefined,
    outbound,
  );
  return { service, executions, runs, steps, queue, trigger, logger };
}

const attempt = (n: number, of = 5) => ({ attemptsMade: n - 1, attempts: of });
const check = (data: Record<string, unknown> = {}): Node => ({
  id: "c",
  type: "condition",
  data: { url: "https://hooks.example.com/check", mode: "api", ...data },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("retries", () => {
  it("an API check that answers 503 twice and then 200 takes Yes", async () => {
    const statuses = [503, 503, 200];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: statuses.shift()! })));
    const { service, runs, steps } = setup(check());
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    await expect(service.processStep(1, "c", "https://app.test", attempt(1))).rejects.toBeInstanceOf(RetryableStepError);
    expect(steps.get("1:c")).toMatchObject({ status: "PENDING", result: { error: "API check answered 503", attempts: 1 } });
    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "c" });

    await expect(service.processStep(1, "c", "https://app.test", attempt(2))).rejects.toBeInstanceOf(RetryableStepError);
    await service.processStep(1, "c", "https://app.test", attempt(3));

    expect(runs.get(1)).toMatchObject({ currentNodeId: "yes" });
    expect(steps.get("1:c")).toMatchObject({ status: "COMPLETED", result: { branch: "yes" } });
  });

  it("429, a network failure and a timeout are retried; 404 is a plain No", async () => {
    for (const fail of [
      async () => new Response(null, { status: 429 }),
      async () => {
        throw new TypeError("fetch failed");
      },
      async () => {
        throw new DOMException("The operation timed out", "TimeoutError");
      },
    ]) {
      vi.stubGlobal("fetch", vi.fn(fail));
      const { service } = setup(check());
      await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
      await expect(service.processStep(1, "c", "https://app.test", attempt(1))).rejects.toBeInstanceOf(RetryableStepError);
    }

    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const { service, runs } = setup(check());
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.processStep(1, "c", "https://app.test", attempt(1));
    expect(runs.get(1)).toMatchObject({ currentNodeId: "no" });
  });

  it("on the last attempt a retryable error fails the run (default onError)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const { service, runs, steps } = setup(check());
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    await service.processStep(1, "c", "https://app.test", attempt(5));

    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
    expect(steps.get("1:c")).toMatchObject({ status: "FAILED" });
  });

  it("a refused address is permanent: no retry, onError at once", async () => {
    const refuse: OutboundPolicy = { allow: async () => ({ allowed: false, reason: "internal address" }) };
    vi.stubGlobal("fetch", vi.fn());
    const { service, runs } = setup(check(), { outbound: refuse });
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    await service.processStep(1, "c", "https://app.test", attempt(1));

    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
  });

  it("an email step whose send fails on infrastructure is retried; a refusal of the service is not", async () => {
    const mail: Node = { id: "m", type: "action", data: { triggerId: 5 } };
    const a = setup(mail);
    a.trigger.sendTriggeredEmail.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:5432"));
    await a.service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await expect(a.service.processStep(1, "m", "https://app.test", attempt(1))).rejects.toBeInstanceOf(RetryableStepError);

    const b = setup(mail);
    b.trigger.sendTriggeredEmail.mockRejectedValueOnce(new NotFoundError("Campaign"));
    await b.service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await b.service.processStep(1, "m", "https://app.test", attempt(1));
    expect(b.runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
  });
});

describe("onError: continue", () => {
  it("a condition takes No", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 502 })));
    const { service, runs, steps } = setup(check({ onError: "continue" }));
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    await service.processStep(1, "c", "https://app.test", attempt(5));

    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "no" });
    expect(steps.get("1:c")).toMatchObject({ status: "COMPLETED", result: { branch: "no", error: "API check answered 502" } });
  });

  it("another step is SKIPPED and the run goes on; a redelivered job moves on without running it", async () => {
    const { service, runs, steps, trigger } = setup({ id: "m", type: "action", data: { triggerId: 5, onError: "continue" } });
    trigger.sendTriggeredEmail.mockRejectedValueOnce(new NotFoundError("Campaign"));
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    await service.processStep(1, "m", "https://app.test", attempt(1));

    expect(steps.get("1:m")).toMatchObject({ status: "SKIPPED", result: { skipped: "error" } });
    expect(runs.get(1)).toMatchObject({ status: "RUNNING", currentNodeId: "yes" });
    expect(trigger.sendTriggeredEmail).toHaveBeenCalledTimes(1);
  });

  it("a plan refusal still fails the run", async () => {
    const { service, runs, trigger } = setup({ id: "m", type: "action", data: { triggerId: 5, onError: "continue" } });
    trigger.sendTriggeredEmail.mockRejectedValueOnce(new QuotaExceededError("Out of emails"));
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    await service.processStep(1, "m", "https://app.test", attempt(1));

    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
  });
});

describe("worker", () => {
  it("ends the run when the last attempt fails outside the step", async () => {
    const { service, runs, executions } = setup(check());
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    executions.claimStep.mockRejectedValue(new Error("database unreachable"));
    const worker = new AutomationWorkerProcessor(service, { appUrl: "https://app.test" });
    const job = (attemptsMade: number) => ({ data: { executionId: 1, nodeId: "c" }, attemptsMade, opts: { attempts: 5 } }) as never;

    await expect(worker.processAutomationJob(job(0))).rejects.toThrow("database unreachable");
    expect(runs.get(1)).toMatchObject({ status: "RUNNING" });

    await expect(worker.processAutomationJob(job(4))).rejects.toThrow("database unreachable");
    expect(runs.get(1)).toMatchObject({ status: "FAILED", exitReason: "error" });
  });
});

describe("sweeper", () => {
  it("re-queues a due run whose job is gone or failed, leaves one whose job is still queued", async () => {
    const { service, runs, queue } = setup(check());
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.triggerWorkflow({ workflowId: 10, contactId: 4, projectId: 1 });
    await service.triggerWorkflow({ workflowId: 10, contactId: 5, projectId: 1 });
    const longAgo = new Date(Date.now() - 10 * 60 * 1000);
    for (const id of [1, 2, 3]) runs.set(id, { ...runs.get(id)!, wakeAt: longAgo });
    const remove = vi.fn(async () => {});
    queue.getJob.mockImplementation(async (id: string) => {
      if (id === "wf-2-c") return { getState: async () => "delayed", remove };
      if (id === "wf-3-c") return { getState: async () => "failed", remove };
      return null;
    });
    queue.add.mockClear();

    expect(await service.recoverDueRuns()).toEqual({ checked: 3, requeued: 2 });
    expect(queue.add.mock.calls.map((c) => (c as unknown[])[2])).toEqual([{ jobId: "wf-1-c" }, { jobId: "wf-3-c" }]);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("ignores runs not yet due, within the grace, or ended", async () => {
    const { service, runs, queue } = setup(check());
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.triggerWorkflow({ workflowId: 10, contactId: 4, projectId: 1 });
    runs.set(1, { ...runs.get(1)!, wakeAt: new Date(Date.now() - 60 * 1000) });
    runs.set(2, { ...runs.get(2)!, wakeAt: new Date(Date.now() - 60 * 60 * 1000), status: "CANCELLED" });
    queue.add.mockClear();

    expect(await service.recoverDueRuns()).toEqual({ checked: 0, requeued: 0 });
    expect(queue.add).not.toHaveBeenCalled();
  });
});

describe("cancel", () => {
  it("cancels the contact's runs, of one workflow when given", async () => {
    const { service, runs } = setup(check());
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });

    expect(await service.cancelFromRequest(1, { email: "a@b.co" })).toEqual({ cancelled: 1 });
    expect(runs.get(1)).toMatchObject({ status: "CANCELLED", exitReason: "cancelled_api" });
    expect(await service.cancelFromRequest(1, { email: "a@b.co", workflowId: 10 })).toEqual({ cancelled: 0 });
  });

  it("a cancelled run's queued job does nothing", async () => {
    const { service, trigger } = setup({ id: "m", type: "action", data: { triggerId: 5 } });
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    await service.cancelFromRequest(1, { email: "a@b.co" });
    await service.processStep(1, "m", "https://app.test");
    expect(trigger.sendTriggeredEmail).not.toHaveBeenCalled();
  });

  it("validates the body and scopes contact and workflow to the project", async () => {
    const { service } = setup(check());
    await expect(service.cancelFromRequest(1, {})).rejects.toMatchObject({ fieldErrors: { email: expect.any(Array) } });
    await expect(service.cancelFromRequest(1, { email: "a@b.co", workflowId: "10" })).rejects.toMatchObject({
      fieldErrors: { workflowId: expect.any(Array) },
    });
    await expect(service.cancelFromRequest(1, { email: "ghost@b.co" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.cancelFromRequest(2, { email: "a@b.co" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.cancelFromRequest(1, { email: "a@b.co", workflowId: 99 })).rejects.toBeInstanceOf(NotFoundError);
  });
});
