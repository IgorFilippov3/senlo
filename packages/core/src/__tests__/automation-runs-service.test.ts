import { describe, expect, it, vi } from "vitest";
import type { Project, Workflow, WorkflowVersion } from "../domain";
import { NotFoundError, ValidationError } from "../errors";
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
  };
  const automation = {
    cancelRun: vi.fn(async (id: number) => executions.cancel(id, "cancelled_user")),
    startTestRun: vi.fn(async () => ({ id: 5 }) as never),
  };
  const service = new AutomationRunsService(
    { workflows: workflows as never, executions, contacts: contacts as never, projects },
    automation,
  );
  return { service, runs, seed, workflows, automation };
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
    expect(e.details.reasons).toContain("Add a trigger before going live.");
    expect(automation.startTestRun).not.toHaveBeenCalled();
  });
});
