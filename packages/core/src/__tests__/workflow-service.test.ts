import { describe, it, expect, vi } from "vitest";
import { WorkflowService } from "../services/workflowService";
import { FormValidationError, NotFoundError, ValidationError } from "../errors";
import type { Campaign, Project, Workflow, WorkflowGraphSnapshot, WorkflowVersion } from "../domain";

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
    publishVersion: vi.fn(async (workflowId: number, g: WorkflowGraphSnapshot) => {
      const v: WorkflowVersion = { id: versions.length + 1, workflowId, version: versions.length + 1, graph: g, settings: {}, createdAt: new Date() };
      versions.push(v);
      const w = rows.get(workflowId);
      if (w) rows.set(workflowId, { ...w, activeVersionId: v.id });
      return v;
    }),
    getVersion: async (id: number) => versions.find((v) => v.id === id) ?? null,
    findActiveByTrigger: async () => [],
  };
  const versions: WorkflowVersion[] = [];
  const contactEvents = {
    recentNames: vi.fn(async (_projectId: number, _limit: number) => ["trial_started", "invoice.paid"]),
    payloadKeys: vi.fn(async (_projectId: number, name: string, _sample: number) => (name === "trial_started" ? ["plan", "trial_ends_at"] : [])),
  };
  const contacts = { attributeKeys: vi.fn(async (_projectId: number, _sample: number) => ["company", "plan"]) };
  return {
    service: new WorkflowService({ workflows, projects, campaigns, contactEvents, contacts }),
    workflows,
    contactEvents,
    contacts,
    rows,
    versions,
  };
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
        { id: "t", type: "trigger", data: { event: "trial_started" } },
        { id: "x", type: "exit", data: {} },
      ],
      edges: [{ id: "e", sourceNodeId: "t", targetNodeId: "x", sourceHandle: null }],
    });
    expect((await service.setStatus("alice", 10, "ACTIVE")).status).toBe("ACTIVE");
    expect(workflows.update).toHaveBeenCalledWith(10, { status: "ACTIVE" });
  });

  it("refuses to activate a trigger without an event or with a malformed one", async () => {
    for (const [data, reason] of [
      [{}, "Choose the event that starts the automation."],
      [{ event: "" }, "Choose the event that starts the automation."],
      [{ event: "Trial Started" }, '"Trial Started" is not a valid event name.'],
    ] as const) {
      const { service, workflows } = fakes({ nodes: [{ id: "t", type: "trigger", data }] });
      const e = await service.setStatus("alice", 10, "ACTIVE").catch((x) => x);
      expect(e.details.reasons).toContain(reason);
      expect(workflows.update).not.toHaveBeenCalled();
    }
  });

  it("saves a draft trigger without an event, refuses a malformed name or tag", async () => {
    const { service, workflows } = fakes();
    await service.saveGraph("alice", 10, { nodes: [{ id: "t1", type: "trigger", data: { event: "" } }], edges: [] });
    await service.saveGraph("alice", 10, { nodes: [{ id: "t1", type: "trigger", data: { event: "invoice.paid" } }], edges: [] });
    expect(workflows.saveGraph).toHaveBeenCalledTimes(2);

    for (const data of [{ event: "Bad Name" }, { event: 5 }, { event: "tag_added", tag: 5 }]) {
      const e = await service.saveGraph("alice", 10, { nodes: [{ id: "t1", type: "trigger", data }], edges: [] }).catch((x) => x);
      expect(e, JSON.stringify(data)).toBeInstanceOf(FormValidationError);
      expect(e.fieldErrors.t1).toBeDefined();
    }
    expect(workflows.saveGraph).toHaveBeenCalledTimes(2);
  });

  it("suggests contact attributes and the payload keys of the trigger's event", async () => {
    const { service, contactEvents } = fakes();
    expect(await service.fieldSuggestions("alice", 1, "trial_started")).toEqual({
      contact: ["company", "plan"],
      event: ["plan", "trial_ends_at"],
    });
    expect(contactEvents.payloadKeys).toHaveBeenCalledWith(1, "trial_started", 500);
    expect(await service.fieldSuggestions("alice", 1, null)).toEqual({ contact: ["company", "plan"], event: [] });
    expect(await service.fieldSuggestions("alice", 1, "Bad Name")).toMatchObject({ event: [] });
    await expect(service.fieldSuggestions("alice", 2, "x")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("suggests the project's recent event names to its users only", async () => {
    const { service, contactEvents } = fakes();
    expect(await service.recentEventNames("alice", 1)).toEqual(["trial_started", "invoice.paid"]);
    expect(contactEvents.recentNames).toHaveBeenCalledWith(1, 50);
    await expect(service.recentEventNames("alice", 2)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a draft with a trigger node", async () => {
    const { service, workflows } = fakes();
    await expect(service.create("alice", 1, { name: " " })).rejects.toBeInstanceOf(FormValidationError);
    const w = await service.create("alice", 1, { name: " Welcome " });
    expect(w).toMatchObject({ id: 30, projectId: 1, name: "Welcome", status: "DRAFT" });
    expect(workflows.saveGraph).toHaveBeenCalledWith(30, [expect.objectContaining({ type: "trigger", data: { event: "contact_added" } })], []);
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

  it("maps the builder's shape to the stored one, dropping positions", async () => {
    const { service, workflows } = fakes();
    const action = { id: "a1", type: "action", data: { triggerId: 100 }, position: { x: 10, y: 20 } };
    const unset = { id: "a2", type: "action", data: {}, position: { x: 0, y: 0 } };
    await service.saveGraph("alice", 10, {
      nodes: [trigger, action, unset],
      edges: [{ id: "e1", source: "t1", target: "a1", sourceHandle: "yes" }, { id: "e2", source: "a1", target: "a2" }],
    });
    expect(workflows.saveGraph).toHaveBeenCalledWith(
      10,
      [
        { id: "t1", type: "trigger", data: { event: "contact_added" } },
        { id: "a1", type: "action", data: { triggerId: 100 } },
        { id: "a2", type: "action", data: {} },
      ],
      [
        { id: "e1", sourceNodeId: "t1", targetNodeId: "a1", sourceHandle: "yes" },
        { id: "e2", sourceNodeId: "a1", targetNodeId: "a2", sourceHandle: null },
      ],
    );
  });

  describe("versions", () => {
    const liveNodes = [
      { id: "t", type: "trigger", data: { event: "trial_started" } },
      { id: "x", type: "exit", data: {} },
    ];
    const liveEdges = [{ id: "e", sourceNodeId: "t", targetNodeId: "x", sourceHandle: null }];
    const builderGraph = {
      nodes: liveNodes,
      edges: [{ id: "e", source: "t", target: "x", sourceHandle: null }],
    };

    it("going live publishes the saved graph as a version", async () => {
      const { service, workflows } = fakes({ nodes: liveNodes, edges: liveEdges });
      await service.setStatus("alice", 10, "ACTIVE");
      // No settings stored: the version gets empty ones.
      expect(workflows.publishVersion).toHaveBeenCalledWith(10, { nodes: liveNodes, edges: liveEdges }, {});
      expect(workflows.update).toHaveBeenCalledWith(10, { status: "ACTIVE" });
    });

    it("pause and resume without changes publishes nothing new", async () => {
      const { service, workflows } = fakes({ nodes: liveNodes, edges: liveEdges });
      await service.setStatus("alice", 10, "ACTIVE");
      await service.setStatus("alice", 10, "PAUSED");
      await service.setStatus("alice", 10, "ACTIVE");
      expect(workflows.publishVersion).toHaveBeenCalledTimes(1);
    });

    it("saving a live workflow publishes a new version; saving a draft does not", async () => {
      const { service, workflows, rows } = fakes();
      await service.saveGraph("alice", 10, builderGraph);
      expect(workflows.publishVersion).not.toHaveBeenCalled();

      rows.set(10, { ...rows.get(10)!, status: "ACTIVE" });
      await service.saveGraph("alice", 10, builderGraph);
      expect(workflows.publishVersion).toHaveBeenCalledTimes(1);
      // Same graph again, keys in another order: no new version.
      await service.saveGraph("alice", 10, {
        nodes: [liveNodes[1], { data: { event: "trial_started" }, type: "trigger", id: "t" }],
        edges: builderGraph.edges,
      });
      expect(workflows.publishVersion).toHaveBeenCalledTimes(1);

      await service.saveGraph("alice", 10, {
        nodes: [{ id: "t", type: "trigger", data: { event: "invoice_failed" } }, liveNodes[1]],
        edges: builderGraph.edges,
      });
      expect(workflows.publishVersion).toHaveBeenCalledTimes(2);
    });

    it("refuses an incomplete graph on a live workflow and saves nothing", async () => {
      const { service, workflows, rows } = fakes();
      rows.set(10, { ...rows.get(10)!, status: "ACTIVE" });
      const e = await service
        .saveGraph("alice", 10, { nodes: [{ id: "t", type: "trigger", data: { event: "x" } }, { id: "c", type: "condition", data: {} }], edges: [{ id: "e", source: "t", target: "c" }] })
        .catch((x) => x);
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.message).toBe("Pause the automation to save an incomplete draft.");
      expect(e.details.reasons).toContain("A Condition is missing a Yes branch.");
      expect(workflows.saveGraph).not.toHaveBeenCalled();
      expect(workflows.publishVersion).not.toHaveBeenCalled();
    });

    it("refuses step types the engine does not know", async () => {
      const { service, workflows } = fakes();
      for (const type of ["action_email", "condition_api", "teleport"]) {
        const e = await service.saveGraph("alice", 10, { nodes: [{ id: "n", type, data: {} }], edges: [] }).catch((x) => x);
        expect(e, type).toBeInstanceOf(FormValidationError);
        expect(e.fieldErrors.n[0]).toContain(type);
      }
      expect(workflows.saveGraph).not.toHaveBeenCalled();
    });
  });

  describe("settings", () => {
    const liveNodes = [
      { id: "t", type: "trigger", data: { event: "payment_failed" } },
      { id: "x", type: "exit", data: {} },
    ];
    const liveEdges = [{ id: "e", sourceNodeId: "t", targetNodeId: "x", sourceHandle: null }];

    it("stores a draft's settings without publishing", async () => {
      const { service, workflows } = fakes({ nodes: liveNodes, edges: liveEdges });
      const settings = { kind: "lifecycle", goal: { event: "payment_succeeded" }, entry: { mode: "once" } };
      expect(await service.updateSettings("alice", 10, settings)).toEqual(settings);
      expect(workflows.update).toHaveBeenCalledWith(10, { settings });
      expect(workflows.publishVersion).not.toHaveBeenCalled();
    });

    it("on a live workflow publishes a version with the saved graph and the new settings", async () => {
      const { service, workflows, rows } = fakes({ nodes: liveNodes, edges: liveEdges });
      await service.setStatus("alice", 10, "ACTIVE");
      rows.set(10, { ...rows.get(10)!, status: "ACTIVE" });

      await service.updateSettings("alice", 10, { goal: { event: "payment_succeeded" } });

      expect(workflows.publishVersion).toHaveBeenLastCalledWith(10, { nodes: liveNodes, edges: liveEdges }, { goal: { event: "payment_succeeded" } });
      expect(workflows.publishVersion).toHaveBeenCalledTimes(2);
    });

    it("refuses malformed settings with the reasons", async () => {
      const { service, workflows } = fakes();
      await expect(service.updateSettings("alice", 10, { kind: "marketing" })).rejects.toBeInstanceOf(FormValidationError);
      await expect(service.updateSettings("alice", 10, { other: 1 })).rejects.toBeInstanceOf(FormValidationError);
      const e = await service.updateSettings("alice", 10, { goal: { event: "Bad Name" } }).catch((x) => x);
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.details.reasons).toEqual(["The goal needs a valid event name."]);
      const f = await service
        .updateSettings("alice", 10, { goal: { event: "paid", filters: { op: "and", rules: [{ source: "history", event: "x", did: true }] } } })
        .catch((x) => x);
      expect(f.details.reasons).toEqual(["Goal filters: A trigger filter can only check the contact or the event."]);
      expect(workflows.update).not.toHaveBeenCalled();
      await expect(service.updateSettings("alice", 20, {})).rejects.toBeInstanceOf(NotFoundError);
    });

    it("go-live checks the stored settings too", async () => {
      const { service, rows } = fakes({ nodes: liveNodes, edges: liveEdges });
      rows.set(10, { ...rows.get(10)!, settings: { goal: { event: "" } } });
      const e = await service.setStatus("alice", 10, "ACTIVE").catch((x) => x);
      expect(e.details.reasons).toContain("The goal needs a valid event name.");
    });
  });
});
