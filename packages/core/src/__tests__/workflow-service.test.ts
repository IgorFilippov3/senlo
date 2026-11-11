import { describe, it, expect, vi } from "vitest";
import { WorkflowService } from "../services/workflowService";
import { FormValidationError, NotFoundError, ValidationError } from "../errors";
import type { Campaign, Project, Workflow, WorkflowGraphSnapshot, WorkflowVersion } from "../domain";

const projects = {
  findById: async (id: number) =>
    ({ 1: { id: 1, userId: "alice" }, 2: { id: 2, userId: "bob" } } as Record<number, Partial<Project>>)[id] as Project ?? null,
};
const campaignRows = {
  100: { id: 100, projectId: 1, name: "Welcome email", type: "TRIGGERED" },
  101: { id: 101, projectId: 1, name: "Reminder", type: "TRIGGERED" },
  102: { id: 102, projectId: 1, name: "welcome", type: "TRIGGERED" },
  200: { id: 200, projectId: 2, name: "Welcome email", type: "TRIGGERED" },
} as Record<number, Partial<Campaign>>;
const campaigns = {
  findById: async (id: number) => (campaignRows[id] as Campaign) ?? null,
  findByProject: async (projectId: number) =>
    Object.values(campaignRows).filter((c) => c.projectId === projectId) as Campaign[],
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
    createTestVersion: vi.fn(async (workflowId: number, g: WorkflowGraphSnapshot) => {
      const v: WorkflowVersion = { id: versions.length + 1, workflowId, version: -1, graph: g, settings: {}, isTest: true, createdAt: new Date() };
      versions.push(v);
      return v;
    }),
    // A stand-in cipher: reversible, and visibly not the clear value.
    sealSecret: vi.fn(async (value: string) => `sealed:${value}`),
    openSecret: vi.fn(async (token: string) => (token.startsWith("sealed:") ? token.slice(7) : null)),
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

describe("HTTP request headers", () => {
  const http = (headers: unknown[]) => ({ id: "h", type: "http_request", data: { url: "https://x.io", headers } });

  it("seals a header value on save and never stores it in clear", async () => {
    const { service, workflows } = fakes();
    await service.saveGraph("alice", 10, {
      nodes: [trigger, http([{ name: "Authorization", value: "Bearer s3cret" }, { name: " ", value: "dropped" }])],
      edges: [{ id: "e", source: "t1", target: "h" }],
    });
    const [, nodes] = workflows.saveGraph.mock.calls[0] as unknown as [number, Array<{ id: string; data: Record<string, unknown> }>];
    expect(nodes.find((n) => n.id === "h")!.data.headers).toEqual([{ name: "Authorization", sealed: "sealed:Bearer s3cret" }]);
    expect(JSON.stringify(nodes)).not.toContain('"value"');
  });

  it("keeps the stored token for an unchanged value or a sealed one sent back", async () => {
    const stored = http([{ name: "A", sealed: "sealed:one" }, { name: "B", sealed: "sealed:two" }]);
    const { service, workflows } = fakes({ nodes: [trigger, stored] });
    await service.saveGraph("alice", 10, {
      nodes: [trigger, http([{ name: "A", value: "one" }, { name: "B", sealed: "sealed:two" }, { name: "C", value: "three" }])],
      edges: [{ id: "e", source: "t1", target: "h" }],
    });
    const [, nodes] = workflows.saveGraph.mock.calls[0] as unknown as [number, Array<{ id: string; data: Record<string, unknown> }>];
    expect(nodes.find((n) => n.id === "h")!.data.headers).toEqual([
      { name: "A", sealed: "sealed:one" },
      { name: "B", sealed: "sealed:two" },
      { name: "C", sealed: "sealed:three" },
    ]);
    expect(workflows.sealSecret).toHaveBeenCalledTimes(1);
  });

  it("keeps a header without a value by name (an imported step); going live asks for it", async () => {
    const { service, workflows } = fakes();
    await service.saveGraph("alice", 10, { nodes: [trigger, http([{ name: "A" }])], edges: [] });
    const [, nodes] = workflows.saveGraph.mock.calls[0] as unknown as [number, Array<{ id: string; data: Record<string, unknown> }>];
    expect(nodes.find((n) => n.id === "h")!.data.headers).toEqual([{ name: "A" }]);
  });

  it("accepts the restart entry mode", async () => {
    const { service, workflows } = fakes();
    await service.updateSettings("alice", 10, { entry: { mode: "restart" } });
    expect(workflows.update).toHaveBeenCalledWith(10, { settings: { entry: { mode: "restart" } } });
  });
});

describe("export and import", () => {
  const nodes = [
    { id: "t", type: "trigger", data: { event: "signed_up" } },
    { id: "m1", type: "action", data: { triggerId: "100", label: "Welcome" } },
    {
      id: "c",
      type: "condition",
      data: { mode: "rules", conditions: { op: "and", rules: [{ source: "email", nodeId: "m1", state: "not_opened" }] } },
    },
    { id: "m2", type: "action", data: { triggerId: "101" } },
    { id: "h", type: "http_request", data: { url: "https://x.io", body: '{"a": "{{steps.m1.x}}"}', headers: [{ name: "X-Key", sealed: "sealed:k" }] } },
  ];
  const edges = [
    { id: "e1", sourceNodeId: "t", targetNodeId: "m1", sourceHandle: null },
    { id: "e2", sourceNodeId: "m1", targetNodeId: "c", sourceHandle: null },
    { id: "e3", sourceNodeId: "c", targetNodeId: "m2", sourceHandle: "yes" },
    { id: "e4", sourceNodeId: "c", targetNodeId: "h", sourceHandle: "no" },
  ];

  it("exports the draft with trigger names instead of ids and header names only", async () => {
    const { service, rows } = fakes({ nodes, edges });
    rows.set(10, { ...rows.get(10)!, name: "Onboarding", settings: { goal: { event: "paid" } } });
    const exp = await service.exportWorkflow("alice", 10);
    expect(exp).toMatchObject({ format: "senlo.workflow", version: 1, name: "Onboarding", settings: { goal: { event: "paid" } } });
    expect(exp.nodes.find((n) => n.id === "m1")!.data).toEqual({ label: "Welcome", emailRef: "Welcome email" });
    expect(exp.nodes.find((n) => n.id === "h")!.data.headers).toEqual([{ name: "X-Key" }]);
    expect(JSON.stringify(exp)).not.toContain("sealed");
    expect(exp.edges[2]).toEqual({ id: "e3", source: "c", target: "m2", sourceHandle: "yes" });
    await expect(service.exportWorkflow("alice", 20)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.exportForProject(2, 10)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("imports as a new draft: new ids, references followed, emails mapped by name or left empty", async () => {
    const source = fakes({ nodes, edges });
    const exp = await source.service.exportWorkflow("alice", 10);
    exp.nodes.find((n) => n.id === "m2")!.data.emailRef = "Not here";

    const { service, workflows } = fakes();
    const created = await service.importWorkflow("alice", 1, { workflow: exp, name: "Copy" });
    expect(workflows.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: 1, name: "Copy", status: "DRAFT" }));

    const [id, saved, savedEdges] = workflows.saveGraph.mock.calls[0] as unknown as [
      number,
      Array<{ id: string; type: string; data: Record<string, any> }>,
      Array<{ id: string; sourceNodeId: string; targetNodeId: string; sourceHandle: string | null }>,
    ];
    expect(id).toBe(created.id);
    const byType = (t: string) => saved.filter((n) => n.type === t);
    const [m1, m2] = byType("action");
    expect(saved.map((n) => n.id)).not.toContain("m1");
    expect(m1.data).toEqual({ label: "Welcome", triggerId: "100" });
    expect(m2.data).toEqual({});
    expect(byType("condition")[0].data.conditions.rules[0].nodeId).toBe(m1.id);
    expect(byType("http_request")[0].data.body).toBe(`{"a": "{{steps.${m1.id}.x}}"}`);
    expect(byType("http_request")[0].data.headers).toEqual([{ name: "X-Key" }]);
    expect(savedEdges.find((e) => e.sourceHandle === "yes")).toMatchObject({ sourceNodeId: byType("condition")[0].id, targetNodeId: m2.id });
  });

  it("through the API every email must resolve; a chosen id must be a trigger of the workspace", async () => {
    const source = fakes({ nodes, edges });
    const exp = await source.service.exportWorkflow("alice", 10);
    exp.nodes.find((n) => n.id === "m2")!.data.emailRef = "Not here";

    const { service, workflows } = fakes();
    const e = await service.importForProject(1, { workflow: exp }).catch((x) => x);
    expect(e).toBeInstanceOf(ValidationError);
    expect(e.details.reasons).toEqual(['No trigger named "Not here"']);
    await expect(service.importForProject(1, { workflow: exp, emails: { "Not here": 200 } })).rejects.toThrow("Trigger 200 not found");
    expect(workflows.create).not.toHaveBeenCalled();

    await service.importForProject(1, { workflow: exp, emails: { "Not here": 101 } });
    expect(workflows.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a file that is not an export", async () => {
    const { service } = fakes();
    await expect(service.importWorkflow("alice", 1, { workflow: { format: "other" } })).rejects.toThrow("Not a Senlo automation export");
    await expect(service.importWorkflow("alice", 2, { workflow: {} })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("publishes through the API with the editor's checks", async () => {
    const live = [
      { id: "t", type: "trigger", data: { event: "signed_up" } },
      { id: "x", type: "exit", data: {} },
    ];
    const { service, workflows } = fakes({ nodes: live, edges: [{ id: "e", sourceNodeId: "t", targetNodeId: "x", sourceHandle: null }] });
    expect(await service.publishForProject(1, 10)).toMatchObject({ status: "ACTIVE" });
    expect(workflows.update).toHaveBeenCalledWith(10, { status: "ACTIVE" });
    await expect(service.publishForProject(2, 10)).rejects.toBeInstanceOf(NotFoundError);

    const empty = fakes({ nodes: [] });
    await expect(empty.service.publishForProject(1, 10)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("templates", () => {
  it("creates a draft from a gallery template with its settings; unmatched emails stay empty", async () => {
    const { service, workflows } = fakes();
    const created = await service.createFromTemplate("alice", 1, { templateId: "dunning", name: "Dunning" });
    expect(workflows.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 1, name: "Dunning", status: "DRAFT", settings: expect.objectContaining({ goal: { event: "payment_succeeded" } }) }),
    );
    const [id, saved] = workflows.saveGraph.mock.calls[0] as unknown as [number, Array<{ type: string; data: Record<string, unknown> }>];
    expect(id).toBe(created.id);
    const emails = saved.filter((n) => n.type === "action");
    expect(emails).toHaveLength(3);
    expect(emails.every((n) => n.data.triggerId === undefined && typeof n.data.label === "string")).toBe(true);
  });

  it("matches an email step to a trigger with the same name", async () => {
    const { service, workflows } = fakes();
    // Project 1 has a trigger named "welcome"; the template's step is "Welcome" (case does not matter).
    await service.createFromTemplate("alice", 1, { templateId: "welcome" });
    const [, saved] = workflows.saveGraph.mock.calls[0] as unknown as [number, Array<{ type: string; data: Record<string, unknown> }>];
    expect(saved.find((n) => n.type === "action")!.data).toEqual({ label: "Welcome", triggerId: "102" });
  });

  it("refuses an unknown template and other users' workspaces", async () => {
    const { service } = fakes();
    await expect(service.createFromTemplate("alice", 1, { templateId: "digest" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.createFromTemplate("alice", 2, { templateId: "welcome" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
