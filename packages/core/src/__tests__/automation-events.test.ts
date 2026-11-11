import { describe, it, expect, vi } from "vitest";
import type { Workflow, WorkflowVersion } from "../domain";
import type { Logger } from "../logger";
import { AutomationService } from "../services/automationService";
import { fakeExecutions } from "./fakes/executions";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

function workflow(id: number, status: Workflow["status"], trigger: Record<string, unknown>) {
  return {
    workflow: {
      id,
      projectId: 1,
      name: `w${id}`,
      status,
      activeVersionId: 100 + id,
      triggerEvent: typeof trigger.event === "string" ? trigger.event : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Workflow,
    version: {
      id: 100 + id,
      workflowId: id,
      version: 1,
      graph: { nodes: [{ id: `t${id}`, type: "trigger", data: trigger }], edges: [] },
      settings: {},
      createdAt: new Date(),
    } as WorkflowVersion,
  };
}

function setup(defs: ReturnType<typeof workflow>[], { duplicate = false } = {}) {
  const workflows = {
    // What the indexed query returns: ACTIVE, same project, same trigger event.
    findActiveByTrigger: vi.fn(async (projectId: number, name: string) =>
      defs.map((d) => d.workflow).filter((w) => w.projectId === projectId && w.status === "ACTIVE" && w.triggerEvent === name),
    ),
    getVersion: vi.fn(async (id: number) => defs.find((d) => d.version.id === id)?.version ?? null),
  };
  const contactEvents = {
    existsSince: vi.fn(async () => false),
    listSince: vi.fn(async () => []),
    record: vi.fn(async (d: { projectId: number; contactId: number; name: string; payload: Record<string, unknown>; idempotencyKey?: string | null }) =>
      duplicate ? null : { id: 1, createdAt: new Date(), ...d, idempotencyKey: d.idempotencyKey ?? null },
    ),
  };
  // A tag filter reads the contact.
  const contacts = { findById: vi.fn(async (id: number) => ({ id, email: "a@b.co", name: null, locale: null, meta: {} })) };
  // No runs: goals and waits find nothing.
  const service = new AutomationService(
    workflows as never,
    fakeExecutions().repo,
    contacts as never,
    contactEvents,
    {} as never,
    {} as never,
    silent,
  );
  const started = vi.spyOn(service, "triggerWorkflow").mockResolvedValue(null);
  const startedIds = () => started.mock.calls.map(([o]) => o.workflowId);
  return { service, contactEvents, started, startedIds, workflows };
}

describe("AutomationService.handleEvent", () => {
  it("records the event, then starts only the workflows listening for its name", async () => {
    const { service, contactEvents, startedIds } = setup([
      workflow(1, "ACTIVE", { event: "trial_started" }),
      workflow(2, "ACTIVE", { event: "invoice_failed" }),
      workflow(3, "DRAFT", { event: "trial_started" }),
      workflow(4, "PAUSED", { event: "trial_started" }),
    ]);

    const result = await service.handleEvent({ projectId: 1, contactId: 9, name: "trial_started", payload: { plan: "pro" }, idempotencyKey: "k" });

    expect(result.duplicate).toBe(false);
    expect(contactEvents.record).toHaveBeenCalledWith({ projectId: 1, contactId: 9, name: "trial_started", payload: { plan: "pro" }, idempotencyKey: "k" });
    expect(startedIds()).toEqual([1]);
  });

  it("stores an empty payload when none is given", async () => {
    const { service, contactEvents } = setup([]);
    await service.handleEvent({ projectId: 1, contactId: 9, name: "contact_added" });
    expect(contactEvents.record).toHaveBeenCalledWith(expect.objectContaining({ payload: {}, idempotencyKey: null }));
  });

  it("a tag_added trigger with a tag starts only when the event carries that tag", async () => {
    const { service, startedIds, started } = setup([
      workflow(1, "ACTIVE", { event: "tag_added", tag: "vip" }),
      workflow(2, "ACTIVE", { event: "tag_added" }),
      workflow(3, "ACTIVE", { event: "tag_added", tag: "  " }),
    ]);

    await service.handleEvent({ projectId: 1, contactId: 9, name: "tag_added", payload: { tags: ["trial"] } });
    expect(startedIds()).toEqual([2, 3]);

    started.mockClear();
    await service.handleEvent({ projectId: 1, contactId: 9, name: "tag_added", payload: { tags: ["trial", "vip"] } });
    expect(startedIds()).toEqual([1, 2, 3]);
  });

  it("dispatches nothing for a duplicate (the idempotency key was already stored)", async () => {
    const { service, started } = setup([workflow(1, "ACTIVE", { event: "x" })], { duplicate: true });
    const result = await service.handleEvent({ projectId: 1, contactId: 9, name: "x", idempotencyKey: "k" });
    expect(result).toEqual({ event: null, duplicate: true });
    expect(started).not.toHaveBeenCalled();
  });

  it("looks workflows up by event name and reads each version once per process", async () => {
    const { service, workflows } = setup([workflow(1, "ACTIVE", { event: "x" })]);
    await service.handleEvent({ projectId: 1, contactId: 9, name: "x" });
    await service.handleEvent({ projectId: 1, contactId: 10, name: "x" });
    expect(workflows.findActiveByTrigger).toHaveBeenCalledWith(1, "x");
    expect(workflows.getVersion).toHaveBeenCalledTimes(1);
  });

  it("passes the event to the run it starts", async () => {
    const { service, started } = setup([workflow(1, "ACTIVE", { event: "x" })]);
    await service.handleEvent({ projectId: 1, contactId: 9, name: "x", payload: { a: 1 } });
    expect(started).toHaveBeenCalledWith({ workflowId: 1, contactId: 9, projectId: 1, event: { name: "x", payload: { a: 1 } } });
  });
});
