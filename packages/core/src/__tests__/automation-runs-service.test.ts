import { describe, expect, it, vi } from "vitest";
import type { Project, Workflow, WorkflowVersion } from "../domain";
import { NotFoundError, NotPublishableError, RecipientNotAllowedError, ValidationError } from "../errors";
import { AccessGuard, ownerAccessPolicy } from "../access";
import { principalFromApiKey } from "../api-principal";
import { ServiceHooks } from "../hooks";
import { AutomationRunsService } from "../services/automationRunsService";
import { fakeExecutions } from "./fakes/executions";

const projects = {
  findById: async (id: number) =>
    (({ 1: { id: 1, userId: "alice" }, 2: { id: 2, userId: "bob" } }) as Record<number, Partial<Project>>)[id] as Project ?? null,
};

function setup(draft = { nodes: [{ id: "t", workflowId: 10, type: "trigger", data: { event: "signed_up" } }], edges: [] as never[] }) {
  const workflowRows = new Map<number, Partial<Workflow>>([
    [10, { id: 10, projectId: 1, name: "Onboarding", status: "DRAFT", settings: {} }],
    [20, { id: 20, projectId: 2, name: "Other", status: "DRAFT", settings: {} }],
  ]);
  const { repo: executions, runs, seed } = fakeExecutions();
  const testVersion: WorkflowVersion = { id: 99, workflowId: 10, version: -1, graph: { nodes: [], edges: [] }, settings: {}, isTest: true, createdAt: new Date() };
  const workflows = {
    findById: async (id: number) => (workflowRows.get(id) as Workflow) ?? null,
    getNodes: async () => draft.nodes,
    getEdges: async () => draft.edges,
    getVersion: async () => null,
    createTestVersion: vi.fn(async () => testVersion),
  };
  const contacts = {
    findById: async (id: number) => (id === 3 ? { id: 3, projectId: 1, email: "ann@x.io" } : null),
    findByEmail: async (projectId: number, email: string) =>
      projectId === 1 && email === "ann@x.io" ? { id: 3, projectId: 1, email } : null,
    upsert: vi.fn(async (d: { projectId: number; email: string }) => ({ id: 4, ...d })),
  };
  const automation = {
    cancelRun: vi.fn(async (id: number) => executions.cancel(id, "cancelled_user")),
    startTestRun: vi.fn(async () => ({ id: 5 }) as never),
  };
  const hooks = { requireQuota: vi.fn(async () => {}), recordUsage: vi.fn(async () => {}), audit: vi.fn(async () => {}) };
  // Alice owns project 1: her address is the one API test runs may use.
  const guard = new AccessGuard(projects, ownerAccessPolicy, {
    findById: async (id: string) => (id === "alice" ? ({ id, email: "Alice@x.io" } as never) : null),
  });
  const service = new AutomationRunsService(
    { workflows: workflows as never, executions, contacts: contacts as never, projects },
    automation,
    guard,
    hooks as unknown as ServiceHooks,
  );
  return { service, runs, seed, workflows, automation, contacts, hooks };
}

describe("AutomationRunsService", () => {
  it("lists a workflow's runs, without test runs unless asked, and only in the user's projects", async () => {
    const { service, seed } = setup();
    seed({ id: 1, workflowId: 10 });
    seed({ id: 2, workflowId: 10, isTest: true });
    seed({ id: 3, workflowId: 10, status: "COMPLETED" });
    expect((await service.listRuns("alice", 10, {})).runs.map((r) => r.id)).toEqual([3, 1]);
    expect((await service.listRuns("alice", 10, { includeTests: true })).runs.map((r) => r.id)).toEqual([3, 2, 1]);
    expect((await service.listRuns("alice", 10, { status: "RUNNING" })).runs.map((r) => r.id)).toEqual([1]);
    expect((await service.listRuns("alice", 10, { email: "nobody@x.io" })).runs).toEqual([]);
    const page = await service.listRuns("alice", 10, { limit: 1 });
    expect(page).toMatchObject({ runs: [{ id: 3 }], nextBeforeId: 3 });
    await expect(service.listRuns("alice", 20, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it("shows one run and cancels it", async () => {
    const { service, seed, runs } = setup();
    seed({ id: 1, workflowId: 10 });
    const detail = await service.getRun("alice", 1);
    expect(detail.run).toMatchObject({ id: 1, workflowName: "Onboarding", contactEmail: "ann@x.io", generation: 0 });
    expect(await service.cancelRun("alice", 1)).toEqual({ cancelled: true });
    expect(runs.get(1)).toMatchObject({ status: "CANCELLED", exitReason: "cancelled_user" });
    seed({ id: 2, workflowId: 20 });
    await expect(service.cancelRun("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("finds a contact's history by email", async () => {
    const { service, seed } = setup();
    seed({ id: 1, workflowId: 10, contactId: 3 });
    expect((await service.contactRuns("alice", 1, "ann@x.io")).map((r) => r.id)).toEqual([1]);
    expect(await service.contactRuns("alice", 1, "nobody@x.io")).toEqual([]);
    await expect(service.contactRuns("alice", 2, "ann@x.io")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("starts a test run of the draft as a test version, with the trigger's event", async () => {
    const { service, workflows, automation } = setup();
    expect(await service.startTestRun("alice", 10, { email: "ann@x.io", payload: { plan: "pro" } })).toEqual({ runId: 5 });
    expect(workflows.createTestVersion).toHaveBeenCalledWith(10, expect.objectContaining({ nodes: [expect.objectContaining({ id: "t" })] }), {});
    expect(automation.startTestRun).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 10, contactId: 3, event: { name: "signed_up", payload: { plan: "pro" } } }),
    );
    await expect(service.startTestRun("alice", 10, { email: "nobody@x.io" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a draft that cannot run", async () => {
    const { service, automation } = setup({ nodes: [], edges: [] });
    const e = await service.startTestRun("alice", 10, { email: "ann@x.io" }).catch((x) => x);
    expect(e).toBeInstanceOf(ValidationError);
    expect(e).toBeInstanceOf(NotPublishableError);
    expect(e.code).toBe("NOT_PUBLISHABLE");
    expect(e.details.reasons).toContain("Add a trigger before going live.");
    expect(automation.startTestRun).not.toHaveBeenCalled();
  });
});

describe("AutomationRunsService through API v1", () => {
  const agent = principalFromApiKey({ id: 3, projectId: 1, permissions: ["manage"] }, "mcp/1.0.0");

  it("runs a test for a member, creating the contact without firing contact_added", async () => {
    const { service, contacts, automation, hooks } = setup();
    expect(await service.startTestRun(agent, 10, { email: "alice@x.io" })).toEqual({ runId: 5 });

    expect(hooks.requireQuota).toHaveBeenCalledWith({ type: "contact.create", projectId: 1 });
    expect(contacts.upsert).toHaveBeenCalledWith({ projectId: 1, email: "alice@x.io" });
    expect(hooks.recordUsage).toHaveBeenCalledWith({ type: "contact.created", projectId: 1, contactId: 4 });
    expect(automation.startTestRun).toHaveBeenCalledWith(expect.objectContaining({ contactId: 4 }));
    expect(hooks.audit).toHaveBeenCalledWith(expect.objectContaining({ actor: { apiKeyId: 3, client: "mcp/1.0.0" } }));
  });

  it("refuses an address outside the organization, and creates nothing", async () => {
    const { service, contacts, automation } = setup();
    const e = await service.startTestRun(agent, 10, { email: "ann@x.io" }).catch((x) => x);
    expect(e).toBeInstanceOf(RecipientNotAllowedError);
    expect(e.details.allowed).toEqual(["alice@x.io"]);
    expect(contacts.upsert).not.toHaveBeenCalled();
    expect(automation.startTestRun).not.toHaveBeenCalled();
  });

  it("reads a run of its project only", async () => {
    const { service, seed } = setup();
    seed({ id: 1, workflowId: 10, contactId: 3 });
    seed({ id: 2, workflowId: 20 });
    expect((await service.getRun(agent, 1)).run.id).toBe(1);
    await expect(service.getRun(agent, 2)).rejects.toBeInstanceOf(NotFoundError);
  });
});
