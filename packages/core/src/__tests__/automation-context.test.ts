import { afterEach, describe, it, expect, vi } from "vitest";
import type { Contact, WorkflowEdge, WorkflowNode } from "../domain";
import type { Logger } from "../logger";
import { AutomationService } from "../services/automationService";
import { fakeExecutions } from "./fakes/executions";

const silent: Logger = { debug() {}, info() {}, warn() {}, error() {} };

const contact = { id: 3, projectId: 1, email: "ann@x.io", name: "Ann", locale: "de", meta: { first_name: "Ann" } } as unknown as Contact;

function setup(nodes: Omit<WorkflowNode, "workflowId">[], edges: Omit<WorkflowEdge, "workflowId">[] = []) {
  const { repo: executions, runs } = fakeExecutions();
  const workflow = { id: 10, projectId: 1, status: "ACTIVE", activeVersionId: 7 };
  const workflows = {
    findById: async () => workflow,
    getVersion: async (id: number) =>
      id === 7 ? { id: 7, workflowId: 10, version: 1, graph: { nodes, edges }, settings: {}, createdAt: new Date() } : null,
  };
  const contacts = { findById: async () => contact };
  const queue = { add: vi.fn(async () => ({})) };
  const trigger = { sendTriggeredEmail: vi.fn(async () => ({ success: true })) };
  const service = new AutomationService(
    workflows as never,
    executions as never,
    contacts as never,
    { record: async () => null } as never,
    queue as never,
    trigger as never,
    silent,
  );
  return { service, executions, runs, trigger, queue };
}

describe("run context", () => {
  it("copies the trigger event into the new run", async () => {
    const { service, executions } = setup([{ id: "t", type: "trigger", data: { event: "order_created" } }]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "order_created", payload: { total: 42 } } });
    expect(executions.create).toHaveBeenCalledWith({
      workflowId: 10,
      contactId: 3,
      versionId: 7,
      context: { event: { name: "order_created", payload: { total: 42 } }, steps: {} },
      currentNodeId: "t",
    });
  });

  it("a run started without an event has an empty context", async () => {
    const { service, executions } = setup([{ id: "t", type: "trigger", data: {} }]);
    await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1 });
    expect(executions.create).toHaveBeenCalledWith(expect.objectContaining({ context: { steps: {} } }));
  });

  it("the email step sends the step data: attributes, contact, event payload", async () => {
    const { service, trigger } = setup([
      { id: "t", type: "trigger", data: { event: "order_created" } },
      { id: "mail", type: "action", data: { triggerId: 5 } },
    ], [{ id: "e0", sourceNodeId: "t", targetNodeId: "mail", sourceHandle: null }]);
    const run = await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "order_created", payload: { total: 42 } } });

    await service.processStep(run!.id, "mail", "https://app.test");

    expect(trigger.sendTriggeredEmail).toHaveBeenCalledWith({
      campaignId: 5,
      projectId: 1,
      to: "ann@x.io",
      data: {
        first_name: "Ann",
        contact: { first_name: "Ann", email: "ann@x.io", name: "Ann", locale: "de" },
        event: { total: 42 },
        steps: {},
      },
      locale: "de",
      dedupeKey: `wf-${run!.id}-mail`,
    });
  });

  it("the API check posts the trigger event next to the contact", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { service, queue } = setup(
      [
        { id: "t", type: "trigger", data: { event: "order_created" } },
        { id: "check", type: "condition", data: { url: "https://hooks.example.com/check" } },
        { id: "yes", type: "exit", data: {} },
      ],
      [
        { id: "e0", sourceNodeId: "t", targetNodeId: "check", sourceHandle: null },
        { id: "e1", sourceNodeId: "check", targetNodeId: "yes", sourceHandle: "yes" },
      ],
    );
    const run = await service.triggerWorkflow({ workflowId: 10, contactId: 3, projectId: 1, event: { name: "order_created", payload: { total: 42 } } });

    await service.processStep(run!.id, "check", "https://app.test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.example.com/check");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "ann@x.io",
      name: "Ann",
      locale: "de",
      metadata: { first_name: "Ann" },
      meta: { first_name: "Ann" },
      event: { name: "order_created", payload: { total: 42 } },
    });
    expect(queue.add).toHaveBeenLastCalledWith(
      expect.any(String),
      { executionId: run!.id, nodeId: "yes" },
      { delay: 0, jobId: `wf-${run!.id}-yes` },
    );
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
