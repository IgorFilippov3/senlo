"use server";

import { revalidatePath } from "next/cache";
import { access } from "apps/web/lib/access";
import { requireUserId } from "apps/web/lib/session";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeStats,
} from "@senlo/core";
import { AutomationService, TriggerService } from "@senlo/core";
import { getServices, repositories } from "apps/web/lib/services";

const workflowRepo = repositories.workflows;

/** The workflow, if the signed-in user may access its project. */
async function requireWorkflow(id: number): Promise<Workflow> {
  const userId = await requireUserId();
  const workflow = await workflowRepo.findById(id);
  return access.requireInProject(userId, workflow, "Workflow");
}

export async function listWorkflows(
  projectId: number,
): Promise<ActionResult<Workflow[]>> {
  return withErrorHandling(async () => {
    await access.requireProject(await requireUserId(), projectId);
    return await workflowRepo.findByProject(projectId);
  });
}

export async function createWorkflow(
  projectId: number,
  name: string,
): Promise<ActionResult<Workflow>> {
  return withErrorHandling(async () => {
    await access.requireProject(await requireUserId(), projectId);
    const workflow = await workflowRepo.create({
      projectId,
      name,
      status: "DRAFT",
    });

    try {
      // Create initial trigger node using the standard repository method
      await workflowRepo.saveGraph(
        workflow.id,
        [
          {
            id: `trigger-${Date.now()}`, // Use unique ID
            type: "trigger",
            data: { label: "Contact Added", event: "contact_added" },
            positionX: 250,
            positionY: 50,
          },
        ],
        [],
      );
    } catch (err) {
      console.error(
        "Failed to save initial graph, but workflow was created:",
        err,
      );
      // We continue anyway because the workflow exists and can be edited
    }

    revalidatePath(`/workspace/${projectId}/automations`);
    return workflow;
  });
}

export async function getWorkflow(id: number): Promise<
  ActionResult<{
    workflow: Workflow;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  }>
> {
  return withErrorHandling(async () => {
    const workflow = await requireWorkflow(id);

    const [nodes, edges] = await Promise.all([
      workflowRepo.getNodes(id),
      workflowRepo.getEdges(id),
    ]);

    return { workflow, nodes, edges };
  });
}

export async function saveWorkflowGraph(
  id: number,
  nodes: any[],
  edges: any[],
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    await requireWorkflow(id);

    // Map UI nodes to DB nodes
    const dbNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data,
      positionX: Math.round(n.position.x),
      positionY: Math.round(n.position.y),
    }));

    const dbEdges = edges.map((e) => ({
      id: e.id,
      sourceNodeId: e.source,
      targetNodeId: e.target,
      sourceHandle: e.sourceHandle || null,
    }));

    await workflowRepo.saveGraph(id, dbNodes, dbEdges);
  });
}

export async function updateWorkflowStatus(
  id: number,
  status: Workflow["status"],
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const workflow = await requireWorkflow(id);
    await workflowRepo.update(id, { status });
    revalidatePath(`/workspace/${workflow.projectId}/automations`);
  });
}

export async function deleteWorkflow(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const workflow = await requireWorkflow(id);
    await workflowRepo.delete(id);
    revalidatePath(`/workspace/${workflow.projectId}/automations`);
  });
}

export async function getWorkflowStats(
  workflowId: number,
): Promise<ActionResult<WorkflowNodeStats[]>> {
  return withErrorHandling(async () => {
    await requireWorkflow(workflowId);
    return await getServices().automation.getWorkflowStats(workflowId);
  });
}
