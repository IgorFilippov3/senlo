import { Queue } from "bullmq";
import {
  IWorkflowRepository,
  IWorkflowExecutionRepository,
  ContactRepository,
} from "../ports";
import { TriggerService } from "./triggerService";
import { AutomationJobData } from "../queue/types";
import { WorkflowNodeStats, WorkflowEventType } from "../domain";

export class AutomationService {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly executionRepo: IWorkflowExecutionRepository,
    private readonly contactRepo: ContactRepository,
    private readonly automationQueue: Queue<AutomationJobData>,
    private readonly triggerService: TriggerService,
  ) {}

  /**
   * Start a workflow for a contact.
   */
  async triggerWorkflow(options: {
    workflowId: number;
    contactId: number;
    projectId: number;
  }) {
    const { workflowId, contactId, projectId } = options;

    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow || workflow.projectId !== projectId) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "ACTIVE") {
      return null;
    }

    // Check if already running
    const existing = await this.executionRepo.findRunningByContact(
      workflowId,
      contactId,
    );
    if (existing) {
      return existing;
    }

    const execution = await this.executionRepo.create({
      workflowId,
      contactId,
      status: "RUNNING",
    });

    // Find trigger node (assume there is only one for now)
    const nodes = await this.workflowRepo.getNodes(workflowId);
    const triggerNode = nodes.find((n) => n.type === "trigger");

    if (!triggerNode) {
      await this.executionRepo.updateStatus(
        execution.id,
        "COMPLETED",
        new Date(),
      );
      return execution;
    }

    // Schedule next nodes
    await this.scheduleNextNodes(execution.id, triggerNode.id);

    return execution;
  }

  /**
   * Trigger workflows for a specific event.
   */
  async triggerEvent(options: {
    event: WorkflowEventType;
    projectId: number;
    contactId: number;
    metadata?: Record<string, any>;
  }) {
    const { event, projectId, contactId } = options;

    const workflows = await this.workflowRepo.findByProject(projectId);
    for (const workflow of workflows) {
      if (workflow.status === "ACTIVE") {
        const nodes = await this.workflowRepo.getNodes(workflow.id);
        const hasTrigger = nodes.some(
          (n) => n.type === "trigger" && n.data.event === event,
        );

        if (hasTrigger) {
          await this.triggerWorkflow({
            workflowId: workflow.id,
            contactId,
            projectId,
          });
        }
      }
    }
  }

  /**
   * Process a single step in a workflow execution.
   */
  async processStep(
    executionId: number,
    nodeId: string,
    baseUrl: string,
  ): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution || execution.status !== "RUNNING") return;

    const nodes = await this.workflowRepo.getNodes(execution.workflowId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const stepExecution = await this.executionRepo.createStepExecution({
      executionId,
      nodeId,
      status: "PENDING",
    });

    try {
      let nextHandle: string | undefined;

      switch (node.type) {
        case "action":
        case "action_email":
          await this.handleEmailAction(execution, node.data, baseUrl);
          break;

        case "condition":
        case "condition_api":
          nextHandle = await this.handleApiCondition(
            execution,
            node.data,
            baseUrl,
          );
          break;

        case "delay":
          // Delays are handled by BullMQ delay, so if we are here, the delay is over.
          break;

        case "update_contact":
          await this.handleUpdateContactAction(execution, node.data);
          break;

        case "exit":
          // Explicitly mark execution as completed
          await this.executionRepo.updateStatus(
            executionId,
            "COMPLETED",
            new Date(),
          );
          return; // Stop processing and don't schedule next nodes

        default:
          console.warn(`Unknown node type: ${node.type}`);
      }

      await this.executionRepo.updateStepExecution(stepExecution.id, {
        status: "COMPLETED",
        completedAt: new Date(),
      });

      // Schedule next steps
      await this.scheduleNextNodes(executionId, nodeId, nextHandle);
    } catch (error) {
      console.error(
        `Error processing step ${nodeId} for execution ${executionId}:`,
        error,
      );
      await this.executionRepo.updateStepExecution(stepExecution.id, {
        status: "FAILED",
        result: {
          error: error instanceof Error ? error.message : String(error),
        },
        completedAt: new Date(),
      });

      // Also mark the main execution as FAILED so it doesn't block future runs
      await this.executionRepo.updateStatus(executionId, "FAILED", new Date());
    }
  }

  private async handleEmailAction(
    execution: any,
    data: any,
    baseUrl: string,
  ): Promise<void> {
    const campaignId = data.triggerId || data.campaignId || data.templateId;
    if (!campaignId)
      throw new Error(
        "No triggerId, campaignId or templateId specified for email action",
      );

    const workflow = await this.workflowRepo.findById(execution.workflowId);
    if (!workflow) throw new Error("Workflow not found");

    const contact = await this.contactRepo.findById(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    await this.triggerService.sendTriggeredEmail({
      campaignId: Number(campaignId),
      projectId: workflow.projectId,
      to: contact.email,
      data: (contact.meta as any) || {},
      locale: contact.locale || undefined,
      baseUrl,
    });
  }

  private async handleApiCondition(
    execution: any,
    data: any,
    baseUrl: string,
  ): Promise<string> {
    let { url } = data;
    if (!url) throw new Error("No URL specified for API condition");

    // If URL is relative, prepend baseUrl
    if (url.startsWith("/")) {
      url = `${baseUrl}${url}`;
    }

    const contact = await this.contactRepo.findById(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    console.log(`[Automation] API Check for contact ${contact.email}`, {
      url,
      metadata: contact.meta,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: contact.email,
        name: contact.name,
        metadata: contact.meta,
        meta: contact.meta,
      }),
    });

    const result = response.status === 200 ? "yes" : "no";
    console.log(
      `[Automation] API Check result for ${contact.email}: ${result} (Status: ${response.status})`,
    );
    return result;
  }

  private async handleUpdateContactAction(
    execution: any,
    data: any,
  ): Promise<void> {
    const { updates } = data;
    if (!updates) return;

    const contact = await this.contactRepo.findById(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    const currentMeta = (contact.meta as Record<string, any>) || {};
    const updatedMeta = { ...currentMeta };

    // Special handling for tags
    if (updates.tags && Array.isArray(updates.tags)) {
      const currentTags = Array.isArray(currentMeta.tags)
        ? currentMeta.tags
        : [];
      const newTags = Array.from(new Set([...currentTags, ...updates.tags]));
      updatedMeta.tags = newTags;
    }

    // Merge other fields into meta
    for (const [key, value] of Object.entries(updates)) {
      if (key === "tags") continue;
      updatedMeta[key] = value;
    }

    // Prepare update data
    const updateData: any = {
      meta: updatedMeta,
    };

    // If updates contains basic fields like name, update them directly
    if (updates.name) updateData.name = updates.name;
    if (updates.locale) updateData.locale = updates.locale;

    await this.contactRepo.update(contact.id, updateData);
  }

  private async scheduleNextNodes(
    executionId: number,
    sourceNodeId: string,
    handle?: string,
  ): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) return;

    const edges = await this.workflowRepo.getEdges(execution.workflowId);
    const nodes = await this.workflowRepo.getNodes(execution.workflowId);

    const nextEdges = edges.filter(
      (e) =>
        e.sourceNodeId === sourceNodeId &&
        (!handle || e.sourceHandle === handle),
    );

    console.log(
      `[Automation] Scheduling next nodes for ${sourceNodeId}. Handle: ${handle || "any"}. Found ${nextEdges.length} edges.`,
    );

    if (nextEdges.length === 0) {
      // Check if all branches are finished to mark execution as COMPLETED
      // For now, just mark as completed if no more edges
      await this.executionRepo.updateStatus(
        executionId,
        "COMPLETED",
        new Date(),
      );
      return;
    }

    for (const edge of nextEdges) {
      const targetNode = nodes.find((n) => n.id === edge.targetNodeId);
      if (!targetNode) continue;

      let delay = 0;
      if (targetNode.type === "delay") {
        delay = this.parseDelay(targetNode.data);
      }

      await this.automationQueue.add(
        `workflow-${executionId}-${targetNode.id}`,
        {
          executionId,
          nodeId: targetNode.id,
        },
        { delay },
      );
    }
  }

  private parseDelay(data: any): number {
    const { duration, unit } = data; // e.g., { duration: 1, unit: 'days' }
    if (!duration) return 0;

    const multipliers: Record<string, number> = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
    };

    return duration * (multipliers[unit] || 0);
  }

  async getWorkflowStats(workflowId: number): Promise<WorkflowNodeStats[]> {
    return this.executionRepo.getNodeStats(workflowId);
  }
}
