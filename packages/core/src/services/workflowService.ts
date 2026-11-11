// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard, type AccessAction } from "../access";
import { ServiceHooks } from "../hooks";
import type {
  Workflow,
  WorkflowEdge,
  WorkflowGraphSnapshot,
  WorkflowNode,
  WorkflowSettings,
  WorkflowStatus,
} from "../domain";
import { FormValidationError, NotFoundError, ValidationError } from "../errors";
import type {
  ContactRepository,
  ICampaignRepository,
  IContactEventRepository,
  IProjectRepository,
  IWorkflowRepository,
} from "../ports";
import { parseInput } from "../validation";
import { validateWorkflowGraph } from "../workflow-graph";
import { validateWorkflowSettings } from "../workflow-settings";
import { isValidEventName } from "../workflow-events";
import type { HttpStepHeader } from "../workflow-http";
import {
  buildWorkflowExport,
  exportEmailRefs,
  instantiateWorkflowExport,
  parseWorkflowExport,
  type WorkflowExport,
} from "../workflow-export";
import { findWorkflowTemplate } from "../workflow-templates";

/**
 * A node as the builder holds it. No position: the builder lays the graph
 * out from its structure, so a `position` an older client still sends is
 * dropped here.
 */
export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.unknown()).default({}),
});

export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullish(),
});

export const WorkflowGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;

const DurationSchema = z.object({
  duration: z.number().int().positive(),
  unit: z.enum(["minutes", "hours", "days"]),
});

/** A workflow's settings as the builder sends them; the rules inside are checked by `validateWorkflowSettings`. */
export const WorkflowSettingsSchema = z
  .object({
    kind: z.enum(["transactional", "lifecycle"]).optional(),
    goal: z.object({ event: z.string().trim(), filters: z.unknown().optional() }).strict().optional(),
    entry: z
      .object({ mode: z.enum(["once", "after_exit", "restart"]), cooldown: DurationSchema.optional() })
      .strict()
      .optional(),
  })
  .strict();

/**
 * An import: the export file's JSON, an optional new name, and which
 * trigger each email of the export (`emailRef`, the trigger's name in the
 * source workspace) sends here: a trigger id, or null to leave the step
 * empty. A name not in `emails` is looked up among the workspace's triggers.
 */
export const ImportWorkflowSchema = z.object({
  workflow: z.unknown(),
  name: z.string().trim().min(1).max(255).optional(),
  emails: z.record(z.number().int().positive().nullable()).default({}),
});

export const FromTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(1).max(255).optional(),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
});

/** The node every new workflow starts with. */
export function defaultTriggerNode(): Omit<WorkflowNode, "workflowId"> {
  return {
    id: `trigger-${Date.now()}`,
    type: "trigger",
    data: { event: "contact_added" },
  };
}

/** The step types the builder and the engine know. */
export const WORKFLOW_NODE_TYPES = [
  "trigger",
  "action",
  "delay",
  "condition",
  "wait_event",
  "update_contact",
  "http_request",
  "exit",
] as const;

/** Which trigger (campaign) an action node sends (`data.triggerId`). */
function actionCampaignId(node: GraphNode): number | null {
  const raw = node.data.triggerId;
  if (raw === undefined || raw === null || raw === "") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export interface WorkflowServiceRepositories {
  workflows: IWorkflowRepository;
  projects: Pick<IProjectRepository, "findById">;
  campaigns: Pick<ICampaignRepository, "findById" | "findByProject">;
  contactEvents: Pick<IContactEventRepository, "recentNames" | "payloadKeys">;
  contacts: Pick<ContactRepository, "attributeKeys">;
}

/** How many contacts and events field suggestions are read from. */
export const FIELD_SUGGESTION_SAMPLE = 500;

/** What the rule builder suggests for a field. */
export interface FieldSuggestions {
  /** Contact attribute keys seen in the project. */
  contact: string[];
  /** Payload keys of recent events with the trigger's name. */
  event: string[];
}

/** How many event names the trigger panel suggests. */
export const RECENT_EVENT_NAMES_LIMIT = 50;

/**
 * Workflows as the builder manages them: list, create with a starting
 * trigger node, load and save the graph, status, delete. Running them is
 * `AutomationService`.
 */
export class WorkflowService {
  private readonly access: AccessGuard;

  constructor(
    private readonly repos: WorkflowServiceRepositories,
    access?: AccessGuard,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
  ) {
    this.access = access ?? new AccessGuard(repos.projects);
  }

  /** The workflow, if the user may access its project. */
  async requireWorkflow(userId: string, id: number, action: AccessAction): Promise<Workflow> {
    return this.access.requireInProject(userId, await this.repos.workflows.findById(id), "Workflow", action);
  }

  async listForProject(userId: string, projectId: number): Promise<Workflow[]> {
    await this.access.requireProject(userId, projectId, "read");
    return this.repos.workflows.findByProject(projectId);
  }

  /**
   * A draft with its trigger node. The node is saved separately because the
   * repository creates the workflow row first; a failure there leaves an
   * editable, empty workflow rather than none.
   */
  async create(userId: string, projectId: number, rawInput: unknown): Promise<Workflow> {
    await this.access.requireProject(userId, projectId, "write");
    const input = parseInput(CreateWorkflowSchema, rawInput);
    const workflow = await this.repos.workflows.create({
      projectId,
      name: input.name,
      status: "DRAFT",
    });
    await this.repos.workflows.saveGraph(workflow.id, [defaultTriggerNode()], []);
    await this.audit(userId, "created", workflow);
    return workflow;
  }

  /** Event names the project has sent, most recently used first: the trigger panel's suggestions. */
  async recentEventNames(userId: string, projectId: number): Promise<string[]> {
    await this.access.requireProject(userId, projectId, "read");
    return this.repos.contactEvents.recentNames(projectId, RECENT_EVENT_NAMES_LIMIT);
  }

  /**
   * Field names for the rule builder: the project's contact attributes, and
   * the payload keys its events named `eventName` carried. Sampled from the
   * latest rows; a suggestion, not a schema.
   */
  async fieldSuggestions(userId: string, projectId: number, eventName?: string | null): Promise<FieldSuggestions> {
    await this.access.requireProject(userId, projectId, "read");
    const [contact, event] = await Promise.all([
      this.repos.contacts.attributeKeys(projectId, FIELD_SUGGESTION_SAMPLE),
      eventName && isValidEventName(eventName)
        ? this.repos.contactEvents.payloadKeys(projectId, eventName, FIELD_SUGGESTION_SAMPLE)
        : Promise.resolve([]),
    ]);
    return { contact, event };
  }

  async getGraph(
    userId: string,
    id: number,
  ): Promise<{ workflow: Workflow; nodes: WorkflowNode[]; edges: WorkflowEdge[] }> {
    const workflow = await this.requireWorkflow(userId, id, "read");
    const [nodes, edges] = await Promise.all([
      this.repos.workflows.getNodes(id),
      this.repos.workflows.getEdges(id),
    ]);
    return { workflow, nodes, edges };
  }

  /**
   * Validates the builder's graph and stores it. Edges must join nodes of
   * the graph, and an action node may only send a trigger of the workflow's
   * own project: the send path checks that too, but a bad reference should
   * fail at save, where the user can fix it.
   */
  async saveGraph(userId: string, id: number, rawGraph: unknown): Promise<void> {
    const workflow = await this.requireWorkflow(userId, id, "write");
    const snapshot = await this.prepareGraph(workflow, rawGraph);

    // A live workflow's save is a publish (D2): new runs take the new graph at
    // once, runs in flight finish on the version they started on. So it must
    // be complete; an incomplete one can be kept as a draft only after a pause.
    const live = workflow.status === "ACTIVE";
    if (live) this.requireLaunchable(snapshot, workflow.settings, "Pause the automation to save an incomplete draft.");

    await this.repos.workflows.saveGraph(id, snapshot.nodes, snapshot.edges);
    let version: number | undefined;
    if (live) version = (await this.publishIfChanged(workflow, snapshot))?.version;
    await this.audit(userId, "graph_saved", workflow, {
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      ...(version !== undefined ? { version } : {}),
    });
  }

  /**
   * The builder's graph checked and ready to store, as a version keeps it:
   * node types, trigger event names, step options, email steps sending
   * triggers of the workflow's own project, header values sealed.
   */
  private async prepareGraph(
    workflow: Pick<Workflow, "id" | "projectId">,
    rawGraph: unknown,
  ): Promise<WorkflowGraphSnapshot> {
    const id = workflow.id;
    const graph = parseInput(WorkflowGraphSchema, rawGraph);

    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    if (nodeIds.size !== graph.nodes.length) {
      throw new ValidationError("Node ids must be unique");
    }
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        throw new ValidationError(`Edge ${edge.id} connects a node that is not in the graph`);
      }
    }

    for (const node of graph.nodes) {
      if (!(WORKFLOW_NODE_TYPES as readonly string[]).includes(node.type)) {
        throw new FormValidationError({ [node.id]: [`Unknown step type "${node.type}"`] });
      }
    }

    // A draft may have no event yet; a name it does have must be one the API accepts.
    for (const node of graph.nodes) {
      if (node.type !== "trigger") continue;
      const event = node.data.event;
      if (event !== undefined && event !== "" && (typeof event !== "string" || !isValidEventName(event))) {
        throw new FormValidationError({ [node.id]: ["Event name: lowercase letters, digits and _ . : -"] });
      }
      if (node.data.tag !== undefined && typeof node.data.tag !== "string") {
        throw new FormValidationError({ [node.id]: ["Tag must be text"] });
      }
    }

    for (const node of graph.nodes) {
      if (node.type === "condition" && node.data.mode !== undefined && node.data.mode !== "api" && node.data.mode !== "rules") {
        throw new FormValidationError({ [node.id]: ['A Condition decides by "rules" or "api"'] });
      }
      if (node.type === "delay" && node.data.mode !== undefined && node.data.mode !== "for" && node.data.mode !== "until") {
        throw new FormValidationError({ [node.id]: ['A Wait is "for" a time or "until" a date'] });
      }
    }

    for (const node of graph.nodes) {
      const onError = node.data.onError;
      if (onError !== undefined && onError !== "fail" && onError !== "continue") {
        throw new FormValidationError({ [node.id]: ['"If this step fails" must be "fail" or "continue"'] });
      }
    }

    for (const node of graph.nodes) {
      if (node.type !== "action") continue;
      const campaignId = actionCampaignId(node);
      if (campaignId === null) continue;
      const campaign = await this.repos.campaigns.findById(campaignId);
      if (!campaign || campaign.projectId !== workflow.projectId) {
        throw new FormValidationError({ [node.id]: ["Trigger not found in this workspace"] });
      }
    }

    if (graph.nodes.some((n) => n.type === "http_request" && n.data.headers !== undefined)) {
      const stored = new Map((await this.repos.workflows.getNodes(id)).map((n) => [n.id, n]));
      for (const node of graph.nodes) {
        if (node.type !== "http_request" || node.data.headers === undefined) continue;
        const before = stored.get(node.id)?.data?.headers;
        node.data = {
          ...node.data,
          headers: await this.sealHeaders(node.id, node.data.headers, Array.isArray(before) ? before : []),
        };
      }
    }

    const snapshot: WorkflowGraphSnapshot = {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source,
        targetNodeId: e.target,
        sourceHandle: e.sourceHandle ?? null,
      })),
    };
    return snapshot;
  }

  /**
   * An HTTP request step's headers as stored: a `value` the builder sends
   * (new or edited) is sealed into `sealed`; a `sealed` it sends back is kept
   * as is. No clear value is ever stored or sent back to the client. A
   * value equal to the one stored under the same name keeps its token, so
   * saving the same graph again (the editor still holds the clear value it
   * sent) is not a change and a live workflow publishes no new version.
   */
  private async sealHeaders(nodeId: string, raw: unknown, stored: HttpStepHeader[]): Promise<HttpStepHeader[]> {
    if (!Array.isArray(raw)) throw new FormValidationError({ [nodeId]: ["HTTP request headers are malformed"] });
    const headers: HttpStepHeader[] = [];
    for (const item of raw) {
      const header = item as HttpStepHeader | null;
      if (!header || typeof header.name !== "string") {
        throw new FormValidationError({ [nodeId]: ["An HTTP request header has no name"] });
      }
      const name = header.name.trim();
      if (name === "") continue;
      if (typeof header.value === "string") {
        const previous = stored.find((h) => h.name === name && typeof h.sealed === "string")?.sealed;
        const same = previous !== undefined && (await this.repos.workflows.openSecret(previous)) === header.value;
        headers.push({ name, sealed: same ? previous : await this.repos.workflows.sealSecret(header.value) });
      } else if (typeof header.sealed === "string") {
        headers.push({ name, sealed: header.sealed });
      } else {
        // No value yet (an imported step): kept by name; going live asks for it.
        headers.push({ name });
      }
    }
    return headers;
  }

  /** `ValidationError` with every reason when the graph or the settings cannot run. */
  private requireLaunchable(graph: WorkflowGraphSnapshot, settings: WorkflowSettings | undefined, message: string): void {
    const check = validateWorkflowGraph(
      graph.nodes,
      graph.edges.map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, sourceHandle: e.sourceHandle })),
    );
    const reasons = [...(check.valid ? [] : check.reasons), ...validateWorkflowSettings(settings)];
    if (reasons.length > 0) throw new ValidationError(message, { reasons });
  }

  /**
   * Publishes the graph and the workflow's settings as the next version,
   * unless both equal the active one (a pause and resume, or a save without
   * changes, makes no version).
   */
  private async publishIfChanged(workflow: Workflow, graph: WorkflowGraphSnapshot) {
    const settings = workflow.settings ?? {};
    if (workflow.activeVersionId) {
      const active = await this.repos.workflows.getVersion(workflow.activeVersionId);
      if (active && sameGraph(active.graph, graph) && sameValue(active.settings, settings)) return null;
    }
    return this.repos.workflows.publishVersion(workflow.id, graph, settings);
  }

  /** The live graph of a workflow, as a version stores it. */
  private async liveGraph(id: number): Promise<WorkflowGraphSnapshot> {
    const [nodes, edges] = await Promise.all([this.repos.workflows.getNodes(id), this.repos.workflows.getEdges(id)]);
    return {
      nodes: nodes.map(({ id: nodeId, type, data }) => ({ id: nodeId, type, data })),
      edges: edges.map(({ id: edgeId, sourceNodeId, targetNodeId, sourceHandle }) => ({
        id: edgeId,
        sourceNodeId,
        targetNodeId,
        sourceHandle: sourceHandle ?? null,
      })),
    };
  }

  /**
   * Stores the workflow's settings (goal, entry rules, kind). On a live
   * workflow this publishes a new version with the saved graph, like a
   * graph save (D2): new runs follow the new settings, runs in progress keep
   * theirs.
   */
  async updateSettings(userId: string, id: number, rawSettings: unknown): Promise<WorkflowSettings> {
    const workflow = await this.requireWorkflow(userId, id, "write");
    const settings = parseInput(WorkflowSettingsSchema, rawSettings) as WorkflowSettings;
    const problems = validateWorkflowSettings(settings);
    if (problems.length > 0) throw new ValidationError("These settings cannot be saved.", { reasons: problems });

    let version: number | undefined;
    if (workflow.status === "ACTIVE") {
      const graph = await this.liveGraph(id);
      this.requireLaunchable(graph, settings, "These settings cannot be saved on a live automation.");
      await this.repos.workflows.update(id, { settings });
      version = (await this.publishIfChanged({ ...workflow, settings }, graph))?.version;
    } else {
      await this.repos.workflows.update(id, { settings });
    }
    await this.audit(userId, "settings_saved", workflow, version !== undefined ? { version } : undefined);
    return settings;
  }

  /**
   * Going live checks the saved graph with the builder's own rules, so a
   * broken flow cannot be activated from the list or by a direct call. A
   * failure is a `ValidationError` whose `details.reasons` lists every problem.
   */
  async setStatus(userId: string, id: number, status: WorkflowStatus): Promise<Workflow> {
    const workflow = await this.requireWorkflow(userId, id, "write");
    if (status === "ACTIVE") {
      await this.activate(workflow);
    } else {
      // Pausing keeps the active version: runs in flight go on (D3), new ones do not start.
      await this.repos.workflows.update(id, { status });
    }
    await this.audit(userId, "status_changed", workflow, { from: workflow.status, to: status });
    return { ...workflow, status };
  }

  /** The workflow as an export file (D7, D8): its saved draft and settings. */
  async exportWorkflow(userId: string, id: number): Promise<WorkflowExport> {
    return this.exportOf(await this.requireWorkflow(userId, id, "read"));
  }

  /** `GET /api/workflows/{id}`: the export, for a workflow of the API key's project. */
  async exportForProject(projectId: number, id: number): Promise<WorkflowExport> {
    return this.exportOf(await this.requireInProject(projectId, id));
  }

  /**
   * A new DRAFT workflow from an export, in the user's workspace. An email
   * the user did not map and whose name no trigger here has is left empty
   * ("Choose an email"); header values are entered again (D8).
   */
  async importWorkflow(userId: string, projectId: number, rawInput: unknown): Promise<Workflow> {
    await this.access.requireProject(userId, projectId, "write");
    const workflow = await this.importInto(projectId, rawInput, false);
    await this.audit(userId, "imported", workflow);
    return workflow;
  }

  /**
   * `POST /api/workflows`: like an import, but every email must resolve (by
   * the id in `emails`, or by a trigger with that name): a 400 lists those
   * that do not (D9).
   */
  async importForProject(projectId: number, rawInput: unknown): Promise<Workflow> {
    return this.importInto(projectId, rawInput, true);
  }

  /**
   * A new DRAFT from a gallery template (D10): its graph and settings, email
   * steps matched to triggers of this workspace with the same name, the
   * others left to choose.
   */
  async createFromTemplate(userId: string, projectId: number, rawInput: unknown): Promise<Workflow> {
    await this.access.requireProject(userId, projectId, "write");
    const input = parseInput(FromTemplateSchema, rawInput);
    const template = findWorkflowTemplate(input.templateId);
    if (!template) throw new NotFoundError("Template");
    const workflow = await this.importInto(projectId, { workflow: template.workflow, name: input.name }, false);
    await this.audit(userId, "created", workflow, { template: template.id });
    return workflow;
  }

  /** `POST /api/workflows/{id}/publish`: going live, with the editor's checks. */
  async publishForProject(projectId: number, id: number): Promise<Workflow> {
    const workflow = await this.requireInProject(projectId, id);
    await this.activate(workflow);
    return { ...workflow, status: "ACTIVE" };
  }

  private async requireInProject(projectId: number, id: number): Promise<Workflow> {
    const workflow = await this.repos.workflows.findById(id);
    if (!workflow || workflow.projectId !== projectId) throw new NotFoundError("Workflow");
    return workflow;
  }

  private async exportOf(workflow: Workflow): Promise<WorkflowExport> {
    const [graph, campaigns] = await Promise.all([
      this.liveGraph(workflow.id),
      this.repos.campaigns.findByProject(workflow.projectId),
    ]);
    const names = new Map(campaigns.map((c) => [c.id, c.name]));
    return buildWorkflowExport(workflow, graph, (id) => names.get(id) ?? null);
  }

  private async importInto(projectId: number, rawInput: unknown, strict: boolean): Promise<Workflow> {
    const input = parseInput(ImportWorkflowSchema, rawInput);
    const parsed = parseWorkflowExport(input.workflow);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const exp = parsed.data;

    const settings = parseInput(WorkflowSettingsSchema, exp.settings) as WorkflowSettings;
    const problems = validateWorkflowSettings(settings);
    if (problems.length > 0) throw new ValidationError("The export's settings cannot be used.", { reasons: problems });

    // Emails: the id the caller chose, else a trigger of this workspace with that name.
    const triggers = (await this.repos.campaigns.findByProject(projectId)).filter((c) => c.type === "TRIGGERED");
    const emails = new Map<string, number | null>();
    const missing: string[] = [];
    for (const ref of exportEmailRefs(exp)) {
      if (ref in input.emails) {
        const chosen = input.emails[ref];
        if (chosen !== null && !triggers.some((t) => t.id === chosen)) {
          throw new ValidationError(`Trigger ${chosen} not found in this workspace`);
        }
        emails.set(ref, chosen);
        continue;
      }
      const byName = triggers.find((t) => t.name === ref) ?? triggers.find((t) => t.name.toLowerCase() === ref.toLowerCase());
      if (byName) emails.set(ref, byName.id);
      else if (strict) missing.push(ref);
      else emails.set(ref, null);
    }
    if (missing.length > 0) {
      throw new ValidationError("Some emails of the automation have no trigger in this workspace.", {
        reasons: missing.map((name) => `No trigger named "${name}"`),
      });
    }

    const graph = instantiateWorkflowExport(exp, emails, newNodeId);
    // Checked before the workflow exists, so a bad file leaves nothing behind.
    const snapshot = await this.prepareGraph({ id: 0, projectId }, graph);
    const workflow = await this.repos.workflows.create({
      projectId,
      name: input.name ?? exp.name,
      description: exp.description ?? null,
      status: "DRAFT",
      settings,
    });
    await this.repos.workflows.saveGraph(workflow.id, snapshot.nodes, snapshot.edges);
    return workflow;
  }

  /** Going live: the saved graph and settings must pass the builder's rules; publishes the version first. */
  private async activate(workflow: Workflow): Promise<void> {
    const graph = await this.liveGraph(workflow.id);
    this.requireLaunchable(graph, workflow.settings, "This automation cannot go live yet.");
    // The version first: an ACTIVE workflow always has one to start runs on.
    await this.publishIfChanged(workflow, graph);
    await this.repos.workflows.update(workflow.id, { status: "ACTIVE" });
  }

  async delete(userId: string, id: number): Promise<Workflow> {
    const workflow = await this.requireWorkflow(userId, id, "write");
    await this.repos.workflows.delete(id);
    await this.audit(userId, "deleted", workflow);
    return workflow;
  }

  private audit(userId: string, verb: string, workflow: Workflow, details?: Record<string, unknown>) {
    return this.hooks.audit({
      actor: { userId },
      action: `workflow.${verb}`,
      target: { type: "workflow", id: workflow.id, projectId: workflow.projectId },
      details,
    });
  }
}

/** A node or edge id for an imported graph (ids are unique per instance). */
function newNodeId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 21);
}

/** Equal values, object keys in any order. */
function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a ?? {})) === JSON.stringify(canonical(b ?? {}));
}

/** Equal graphs: same nodes (id, type, data) and edges, in any order. */
function sameGraph(a: WorkflowGraphSnapshot, b: WorkflowGraphSnapshot): boolean {
  const key = (g: WorkflowGraphSnapshot) =>
    JSON.stringify({
      nodes: [...g.nodes]
        .sort((x, y) => x.id.localeCompare(y.id))
        .map((n) => [n.id, n.type, canonical(n.data)]),
      edges: [...g.edges]
        .sort((x, y) => x.id.localeCompare(y.id))
        .map((e) => [e.id, e.sourceNodeId, e.targetNodeId, e.sourceHandle ?? null]),
    });
  return key(a) === key(b);
}

/** A value with object keys sorted, so key order does not count as a change. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}
