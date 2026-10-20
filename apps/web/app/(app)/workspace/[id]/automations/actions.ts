"use server";

import { revalidatePath } from "next/cache";
import type { Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeStats } from "@senlo/core";
import { ActionResult, withErrorHandling } from "@/lib/errors";
import { requireUserId } from "@/lib/session";
import { getServices } from "@/lib/services";

export async function listWorkflows(projectId: number): Promise<ActionResult<Workflow[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().workflow.listForProject(userId, projectId);
  });
}

export async function createWorkflow(
  projectId: number,
  name: string,
): Promise<ActionResult<Workflow>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const workflow = await getServices().workflow.create(userId, projectId, { name });
    revalidatePath(`/workspace/${projectId}/automations`);
    return workflow;
  });
}

export async function getWorkflow(
  id: number,
): Promise<ActionResult<{ workflow: Workflow; nodes: WorkflowNode[]; edges: WorkflowEdge[] }>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    return getServices().workflow.getGraph(userId, id);
  });
}

export async function saveWorkflowGraph(
  id: number,
  nodes: unknown[],
  edges: unknown[],
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    await getServices().workflow.saveGraph(userId, id, { nodes, edges });
  });
}

export async function updateWorkflowStatus(
  id: number,
  status: Workflow["status"],
): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const workflow = await getServices().workflow.setStatus(userId, id, status);
    revalidatePath(`/workspace/${workflow.projectId}/automations`);
  });
}

export async function deleteWorkflow(id: number): Promise<ActionResult<void>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    const workflow = await getServices().workflow.delete(userId, id);
    revalidatePath(`/workspace/${workflow.projectId}/automations`);
  });
}

export async function getWorkflowStats(
  workflowId: number,
): Promise<ActionResult<WorkflowNodeStats[]>> {
  return withErrorHandling(async () => {
    const userId = await requireUserId();
    await getServices().workflow.requireWorkflow(userId, workflowId);
    return getServices().automation.getWorkflowStats(workflowId);
  });
}
