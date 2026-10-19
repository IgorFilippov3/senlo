import { describe, it, expect, vi } from "vitest";
import { WorkflowService } from "../services/workflowService";
import { FormValidationError, NotFoundError, ValidationError } from "../errors";
import type { Campaign, Project, Workflow } from "../domain";

const projects = {
  findById: async (id: number) =>
    ({ 1: { id: 1, userId: "alice" }, 2: { id: 2, userId: "bob" } } as Record<number, Partial<Project>>)[id] as Project ?? null,
};
const campaigns = {
  findById: async (id: number) =>
    ({ 100: { id: 100, projectId: 1 }, 200: { id: 200, projectId: 2 } } as Record<number, Partial<Campaign>>)[id] as Campaign ?? null,
};

function fakes(graph: { nodes?: any[]; edges?: any[] } = {}) {
  const rows = new Map<number, Workflow>([
    [10, { id: 10, projectId: 1, name: "w", status: "DRAFT", createdAt: new Date(), updatedAt: new Date() }],
    [20, { id: 20, projectId: 2, name: "w", status: "DRAFT", createdAt: new Date(), updatedAt: new Date() }],
  ]);
  const workflows = {
    findById: async (id: number) => rows.get(id) ?? null,
    findByProject: async (pid: number) => [...rows.values()].filter((w) => w.projectId === pid),
    create: vi.fn(async (d: any) => {
      const w = { ...d, id: 30, createdAt: new Date(), updatedAt: new Date() } as Workflow;
      rows.set(30, w);
      return w;
    }),
    update: vi.fn(async (id: number, d: Partial<Workflow>) => (rows.has(id) ? { ...rows.get(id)!, ...d } : null)),
    delete: vi.fn(async (id: number) => { rows.delete(id); }),
    getNodes: async () => graph.nodes ?? [],
    getEdges: async () => graph.edges ?? [],
    saveGraph: vi.fn(async () => {}),
  };
  return { service: new WorkflowService({ workflows, projects, campaigns }), workflows };
}

const trigger = { id: "t1", type: "trigger", data: { event: "contact_added" }, position: { x: 1.4, y: 2.6 } };

describe("WorkflowService", () => {
  it("scopes list, get, status and delete to the user's project", async () => {
    const { service } = fakes();
    expect((await service.listForProject("alice", 1)).map((w) => w.id)).toEqual([10]);
    await expect(service.listForProject("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getGraph("alice", 20)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.setStatus("alice", 20, "ACTIVE")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete("alice", 20)).rejects.toBeInstanceOf(NotFoundError);
    expect((await service.getGraph("alice", 10)).workflow.id).toBe(10);
  });

  it("refuses to activate a saved graph the builder would not let go live", async () => {
    const { service, workflows } = fakes({ nodes: [] });
    const e = await service.setStatus("alice", 10, "ACTIVE").catch((x) => x);
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.details.reasons).toContain("Add a trigger before going live.");
    expect(workflows.update).not.toHaveBeenCalled();
    // Pausing or drafting never needs a valid graph.
    await service.setStatus("alice", 10, "PAUSED");
    expect(workflows.update).toHaveBeenCalledWith(10, { status: "PAUSED" });
  });

  it("activates a valid saved graph", async () => {
    const { service, workflows } = fakes({
      nodes: [
        { id: "t", type: "trigger", data: {} },
        { id: "x", type: "exit", data: {} },
      ],
      edges: [{ id: "e", sourceNodeId: "t", targetNodeId: "x", sourceHandle: null }],
    });
    expect((await service.setStatus("alice", 10, "ACTIVE")).status).toBe("ACTIVE");
    expect(workflows.update).toHaveBeenCalledWith(10, { status: "ACTIVE" });
  });

  it("creates a draft with a trigger node", async () => {
    const { service, workflows } = fakes();
    await expect(service.create("alice", 1, { name: " " })).rejects.toBeInstanceOf(FormValidationError);
    const w = await service.create("alice", 1, { name: " Welcome " });
    expect(w).toMatchObject({ id: 30, projectId: 1, name: "Welcome", status: "DRAFT" });
    expect(workflows.saveGraph).toHaveBeenCalledWith(30, [expect.objectContaining({ type: "trigger", data: { label: "Contact Added", event: "contact_added" } })], []);
  });

  it("rejects a malformed graph, dangling edges and duplicate ids", async () => {
    const { service, workflows } = fakes();
    await expect(service.saveGraph("alice", 10, { nodes: [{ id: "x" }], edges: [] })).rejects.toBeInstanceOf(FormValidationError);
    await expect(service.saveGraph("alice", 10, { nodes: [trigger], edges: [{ id: "e", source: "t1", target: "ghost" }] })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.saveGraph("alice", 10, { nodes: [trigger, trigger], edges: [] })).rejects.toBeInstanceOf(ValidationError);
    expect(workflows.saveGraph).not.toHaveBeenCalled();
  });

  it("refuses an action node pointing at another project's trigger", async () => {
    const { service, workflows } = fakes();
    const action = { id: "a1", type: "action", data: { triggerId: "200" }, position: { x: 0, y: 0 } };
    const e = await service.saveGraph("alice", 10, { nodes: [trigger, action], edges: [] }).catch((x) => x);
    expect(e).toBeInstanceOf(FormValidationError);
    expect(e.fieldErrors).toEqual({ a1: ["Trigger not found in this workspace"] });
    expect(workflows.saveGraph).not.toHaveBeenCalled();
  });

  it("maps the builder's shape to the stored one", async () => {
    const { service, workflows } = fakes();
    const action = { id: "a1", type: "action_email", data: { campaignId: 100 }, position: { x: 10, y: 20 } };
    const unset = { id: "a2", type: "action", data: {}, position: { x: 0, y: 0 } };
    await service.saveGraph("alice", 10, {
      nodes: [trigger, action, unset],
      edges: [{ id: "e1", source: "t1", target: "a1", sourceHandle: "yes" }, { id: "e2", source: "a1", target: "a2" }],
    });
    expect(workflows.saveGraph).toHaveBeenCalledWith(
      10,
      [
        { id: "t1", type: "trigger", data: { event: "contact_added" }, positionX: 1, positionY: 3 },
        { id: "a1", type: "action_email", data: { campaignId: 100 }, positionX: 10, positionY: 20 },
        { id: "a2", type: "action", data: {}, positionX: 0, positionY: 0 },
      ],
      [
        { id: "e1", sourceNodeId: "t1", targetNodeId: "a1", sourceHandle: "yes" },
        { id: "e2", sourceNodeId: "a1", targetNodeId: "a2", sourceHandle: null },
      ],
    );
  });
});
