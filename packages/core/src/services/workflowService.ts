// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard, type AccessAction } from "../access";
import { ServiceHooks } from "../hooks";
import type { Workflow, WorkflowEdge, WorkflowGraphSnapshot, WorkflowNode, WorkflowStatus } from "../domain";
import { FormValidationError, ValidationError } from "../errors";
import type {
  ICampaignRepository,
  IContactEventRepository,
  IProjectRepository,
  IWorkflowRepository,
} from "../ports";
import { parseInput } from "../validation";
import { validateWorkflowGraph } from "../workflow-graph";
import { isValidEventName } from "../workflow-events";

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
export const WORKFLOW_NODE_TYPES = ["trigger", "action", "delay", "condition", "update_contact", "exit"] as const;

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
  campaigns: Pick<ICampaignRepository, "findById">;
  contactEvents: Pick<IContactEventRepository, "recentNames">;
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
      if (node.type !== "action") continue;
      const campaignId = actionCampaignId(node);
      if (campaignId === null) continue;
      const campaign = await this.repos.campaigns.findById(campaignId);
      if (!campaign || campaign.projectId !== workflow.projectId) {
        throw new FormValidationError({ [node.id]: ["Trigger not found in this workspace"] });
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

    // A live workflow's save is a publish (D2): new runs take the new graph at
    // once, runs in flight finish on the version they started on. So it must
    // be complete; an incomplete one can be kept as a draft only after a pause.
    const live = workflow.status === "ACTIVE";
    if (live) this.requireLaunchable(snapshot, "Pause the automation to save an incomplete draft.");

    await this.repos.workflows.saveGraph(id, snapshot.nodes, snapshot.edges);
    let version: number | undefined;
    if (live) version = (await this.publishIfChanged(workflow, snapshot))?.version;
    await this.audit(userId, "graph_saved", workflow, {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      ...(version !== undefined ? { version } : {}),
    });
  }

  /** `ValidationError` with every reason when the graph cannot run. */
  private requireLaunchable(graph: WorkflowGraphSnapshot, message: string): void {
    const check = validateWorkflowGraph(
      graph.nodes,
      graph.edges.map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, sourceHandle: e.sourceHandle })),
    );
    if (!check.valid) throw new ValidationError(message, { reasons: check.reasons });
  }

  /**
   * Publishes the graph as the next version, unless it equals the active
   * one (a pause and resume, or a save without changes, makes no version).
   */
  private async publishIfChanged(workflow: Workflow, graph: WorkflowGraphSnapshot) {
    if (workflow.activeVersionId) {
      const active = await this.repos.workflows.getVersion(workflow.activeVersionId);
      if (active && sameGraph(active.graph, graph)) return null;
    }
    return this.repos.workflows.publishVersion(workflow.id, graph);
  }

  /**
   * Going live checks the saved graph with the builder's own rules, so a
   * broken flow cannot be activated from the list or by a direct call. A
   * failure is a `ValidationError` whose `details.reasons` lists every problem.
   */
  async setStatus(userId: string, id: number, status: WorkflowStatus): Promise<Workflow> {
    const workflow = await this.requireWorkflow(userId, id, "write");
    if (status === "ACTIVE") {
      const [nodes, edges] = await Promise.all([
        this.repos.workflows.getNodes(id),
        this.repos.workflows.getEdges(id),
      ]);
      const graph: WorkflowGraphSnapshot = {
        nodes: nodes.map(({ id: nodeId, type, data }) => ({ id: nodeId, type, data })),
        edges: edges.map(({ id: edgeId, sourceNodeId, targetNodeId, sourceHandle }) => ({
          id: edgeId,
          sourceNodeId,
          targetNodeId,
          sourceHandle: sourceHandle ?? null,
        })),
      };
      this.requireLaunchable(graph, "This automation cannot go live yet.");
      // The version first: an ACTIVE workflow always has one to start runs on.
      await this.publishIfChanged(workflow, graph);
    }
    // Pausing keeps the active version: runs in flight go on (D3), new ones do not start.
    await this.repos.workflows.update(id, { status });
    await this.audit(userId, "status_changed", workflow, { from: workflow.status, to: status });
    return { ...workflow, status };
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
