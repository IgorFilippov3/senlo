"use server";

import { revalidatePath } from "next/cache";
import {
  WorkflowRepository,
  WorkflowExecutionRepository,
  ContactRepository,
  CampaignRepository,
  EmailTemplateRepository,
  EmailProviderRepository,
  ProjectRepository,
  TriggeredSendLogRepository,
  db,
} from "@senlo/db";
import { auth } from "apps/web/auth";
import { ActionResult, withErrorHandling } from "apps/web/lib/errors";
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeStats,
} from "@senlo/core";
import { AutomationService, TriggerService } from "@senlo/core";
import { emailQueue, automationQueue } from "@senlo/core/src/queue";

const workflowRepo = new WorkflowRepository(db);
const executionRepo = new WorkflowExecutionRepository(db);
const contactRepo = new ContactRepository(db);
const campaignRepo = new CampaignRepository(db);
const templateRepo = new EmailTemplateRepository(db);
const providerRepo = new EmailProviderRepository(db);
const projectRepo = new ProjectRepository(db);
const logRepo = new TriggeredSendLogRepository(db);

const triggerService = new TriggerService(
  campaignRepo,
  templateRepo,
  providerRepo,
  projectRepo,
  logRepo,
  emailQueue,
);

const automationService = new AutomationService(
  workflowRepo,
  executionRepo,
  contactRepo,
  automationQueue,
  triggerService,
);

export async function listWorkflows(
  projectId: number,
): Promise<ActionResult<Workflow[]>> {
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    return await workflowRepo.findByProject(projectId);
  });
}

export async function createWorkflow(
  projectId: number,
  name: string,
): Promise<ActionResult<Workflow>> {
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
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
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    const workflow = await workflowRepo.findById(id);
    if (!workflow) throw new Error("Workflow not found");

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
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
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
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    await workflowRepo.update(id, { status });
    const workflow = await workflowRepo.findById(id);
    if (workflow) {
      revalidatePath(`/workspace/${workflow.projectId}/automations`);
    }
  });
}

export async function deleteWorkflow(id: number): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    const workflow = await workflowRepo.findById(id);
    if (workflow) {
      await workflowRepo.delete(id);
      revalidatePath(`/workspace/${workflow.projectId}/automations`);
    }
  });
}

export async function getWorkflowStats(
  workflowId: number,
): Promise<ActionResult<WorkflowNodeStats[]>> {
  const session = await auth();
  if (!session?.user?.id)
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 },
    };

  return withErrorHandling(async () => {
    return await automationService.getWorkflowStats(workflowId);
  });
}
