// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard } from "../access";
import { ServiceHooks } from "../hooks";
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowStatus } from "../domain";
import { FormValidationError, ValidationError } from "../errors";
import type { ICampaignRepository, IProjectRepository, IWorkflowRepository } from "../ports";
import { parseInput } from "../validation";
import { validateWorkflowGraph } from "../workflow-graph";

/** A node as the builder holds it: React Flow shape, position as a point. */
export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
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
    data: { label: "Contact Added", event: "contact_added" },
    positionX: 250,
    positionY: 50,
  };
}

/** Which trigger (campaign) an action node sends, under the keys the builder has used over time. */
function actionCampaignId(node: GraphNode): number | null {
  const raw = node.data.triggerId ?? node.data.campaignId ?? node.data.templateId;
  if (raw === undefined || raw === null || raw === "") return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export interface WorkflowServiceRepositories {
  workflows: IWorkflowRepository;
  projects: Pick<IProjectRepository, "findById">;
  campaigns: Pick<ICampaignRepository, "findById">;
}

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
  async requireWorkflow(userId: string, id: number): Promise<Workflow> {
    return this.access.requireInProject(userId, await this.repos.workflows.findById(id), "Workflow");
  }

  async listForProject(userId: string, projectId: number): Promise<Workflow[]> {
    await this.access.requireProject(userId, projectId);
    return this.repos.workflows.findByProject(projectId);
  }

  /**
   * A draft with its trigger node. The node is saved separately because the
   * repository creates the workflow row first; a failure there leaves an
   * editable, empty workflow rather than none.
   */
  async create(userId: string, projectId: number, rawInput: unknown): Promise<Workflow> {
    await this.access.requireProject(userId, projectId);
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

  async getGraph(
    userId: string,
    id: number,
  ): Promise<{ workflow: Workflow; nodes: WorkflowNode[]; edges: WorkflowEdge[] }> {
    const workflow = await this.requireWorkflow(userId, id);
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
    const workflow = await this.requireWorkflow(userId, id);
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
      if (node.type !== "action" && node.type !== "action_email") continue;
      const campaignId = actionCampaignId(node);
      if (campaignId === null) continue;
      const campaign = await this.repos.campaigns.findById(campaignId);
      if (!campaign || campaign.projectId !== workflow.projectId) {
        throw new FormValidationError({ [node.id]: ["Trigger not found in this workspace"] });
      }
    }

    await this.repos.workflows.saveGraph(
      id,
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        data: n.data,
        positionX: Math.round(n.position.x),
        positionY: Math.round(n.position.y),
      })),
      graph.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source,
        targetNodeId: e.target,
        sourceHandle: e.sourceHandle ?? null,
      })),
    );
    await this.audit(userId, "graph_saved", workflow, { nodes: graph.nodes.length, edges: graph.edges.length });
  }

  /**
   * Going live checks the saved graph with the builder's own rules, so a
   * broken flow cannot be activated from the list or by a direct call. A
   * failure is a `ValidationError` whose `details.reasons` lists every problem.
   */
  async setStatus(userId: string, id: number, status: WorkflowStatus): Promise<Workflow> {
    const workflow = await this.requireWorkflow(userId, id);
    if (status === "ACTIVE") {
      const [nodes, edges] = await Promise.all([
        this.repos.workflows.getNodes(id),
        this.repos.workflows.getEdges(id),
      ]);
      const check = validateWorkflowGraph(
        nodes,
        edges.map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, sourceHandle: e.sourceHandle })),
      );
      if (!check.valid) {
        throw new ValidationError("This automation cannot go live yet.", { reasons: check.reasons });
      }
    }
    await this.repos.workflows.update(id, { status });
    await this.audit(userId, "status_changed", workflow, { from: workflow.status, to: status });
    return { ...workflow, status };
  }

  async delete(userId: string, id: number): Promise<Workflow> {
    const workflow = await this.requireWorkflow(userId, id);
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
