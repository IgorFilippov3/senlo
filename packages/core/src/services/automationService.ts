import { Queue } from "bullmq";
import {
  IWorkflowRepository,
  IWorkflowExecutionRepository,
  ContactRepository,
  IContactEventRepository,
  CompleteStep,
} from "../ports";
import { TriggerService } from "./triggerService";
import { AutomationJobData } from "../queue/types";
import type {
  ContactEvent,
  ExecutionContext,
  WorkflowExecution,
  WorkflowNodeStats,
  WorkflowVersion,
} from "../domain";
import { buildStepData } from "../workflow-step-data";
import { triggerMatches, type WorkflowEvent } from "../workflow-events";
import { ServiceHooks } from "../hooks";
import { consoleLogger, type Logger } from "../logger";
import { allowAllOutbound, fetchWithPolicy, type OutboundPolicy } from "../outbound";

/** The queue job of a run's step; stable, so a second add of it is ignored. */
export function automationJobId(executionId: number, nodeId: string): string {
  return `wf-${executionId}-${nodeId}`;
}

/** Versions one worker process keeps in memory. */
const VERSION_CACHE_SIZE = 500;

export class AutomationService {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly executionRepo: IWorkflowExecutionRepository,
    private readonly contactRepo: ContactRepository,
    private readonly contactEvents: Pick<IContactEventRepository, "record">,
    private readonly automationQueue: Queue<AutomationJobData>,
    private readonly triggerService: TriggerService,
    private readonly logger: Logger = consoleLogger,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
    /** Where the "API condition" node may POST; see `OutboundPolicy`. */
    private readonly outbound: OutboundPolicy = allowAllOutbound,
  ) {}

  /** Versions are immutable, so each worker process keeps the ones it has read. */
  private readonly versions = new Map<number, WorkflowVersion>();

  private async loadVersion(id: number): Promise<WorkflowVersion | null> {
    const cached = this.versions.get(id);
    if (cached) return cached;
    const version = await this.workflowRepo.getVersion(id);
    if (!version) return null;
    if (this.versions.size >= VERSION_CACHE_SIZE) {
      // Oldest first: a Map iterates in insertion order.
      this.versions.delete(this.versions.keys().next().value!);
    }
    this.versions.set(id, version);
    return version;
  }

  /**
   * Start a workflow for a contact. `event` is the trigger event: copied into
   * the run's context, it is what `{{event.*}}` reads in its emails.
   */
  async triggerWorkflow(options: {
    workflowId: number;
    contactId: number;
    projectId: number;
    event?: WorkflowEvent;
  }) {
    const { workflowId, contactId, projectId, event } = options;

    const workflow = await this.workflowRepo.findById(workflowId);
    if (!workflow || workflow.projectId !== projectId) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "ACTIVE") {
      return null;
    }

    // New runs start on the active version; an ACTIVE workflow without one
    // predates versions and gets it from `db:upgrade-automations`.
    const version = workflow.activeVersionId ? await this.loadVersion(workflow.activeVersionId) : null;
    if (!version) {
      this.logger.warn("Active workflow has no published version; run `pnpm db:upgrade-automations`", {
        workflowId,
      });
      return null;
    }

    const triggerNode = version.graph.nodes.find((n) => n.type === "trigger");
    if (!triggerNode) {
      // Go-live refuses such a graph; a version without a trigger cannot start.
      this.logger.error("Workflow version has no trigger step", { workflowId, versionId: version.id });
      return null;
    }

    // Already running: the cheap answer, before the plan check. The unique
    // index below is what actually guarantees one run.
    const existing = await this.executionRepo.findRunningByContact(workflowId, contactId);
    if (existing) {
      return existing;
    }

    // A run is the unit a plan counts: refused here, before the execution
    // row exists, so a re-trigger of a running contact is free and the
    // caller gets the reason (`QuotaExceededError`, 402 on the API).
    await this.hooks.requireQuota({ type: "automation.start", projectId, workflowId });

    const context: ExecutionContext = {
      ...(event ? { event: { name: event.name, payload: event.payload } } : {}),
      steps: {},
    };
    const execution = await this.executionRepo.create({
      workflowId,
      contactId,
      versionId: version.id,
      context,
      currentNodeId: triggerNode.id,
    });
    if (!execution) {
      // Lost the race to a concurrent entry: that run is the one, counted once.
      return this.executionRepo.findRunningByContact(workflowId, contactId);
    }
    await this.hooks.recordUsage({
      type: "automation.started",
      projectId,
      workflowId,
      executionId: execution.id,
    });

    await this.advance(execution.id, version, triggerNode.id);

    return execution;
  }

  /**
   * The one way an event enters automations (events API, contact creation
   * from the UI or an import): store it in the event log, then dispatch it.
   * An idempotency key the project has already used stores and dispatches
   * nothing (`duplicate: true`).
   *
   * Dispatch order is fixed: goals, then runs waiting for this event, then
   * triggers (the first two arrive with goals and wait-for-event), so the
   * event that ends a run may also start a new one.
   *
   * A plan refusal (`QuotaExceededError`) comes out of the first run it
   * stops: the runs before it have started and the event stays stored; the
   * caller (events API, contact creation) reports the reason.
   */
  async handleEvent(options: {
    projectId: number;
    contactId: number;
    name: string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<{ event: ContactEvent | null; duplicate: boolean }> {
    const { projectId, contactId, name } = options;
    const payload = options.payload ?? {};

    const event = await this.contactEvents.record({
      projectId,
      contactId,
      name,
      payload,
      idempotencyKey: options.idempotencyKey ?? null,
    });
    if (!event) return { event: null, duplicate: true };

    await this.dispatchTriggers(projectId, contactId, { name, payload });
    return { event, duplicate: false };
  }

  /**
   * Starts every ACTIVE workflow of the project whose active version's
   * trigger accepts the event. The lookup goes through the trigger event
   * name copied onto the workflow (indexed), then the version's trigger node
   * decides on the rest (the tag of a `tag_added` trigger).
   */
  private async dispatchTriggers(
    projectId: number,
    contactId: number,
    event: WorkflowEvent,
  ): Promise<void> {
    const workflows = await this.workflowRepo.findActiveByTrigger(projectId, event.name);
    for (const workflow of workflows) {
      if (!workflow.activeVersionId) continue;
      const version = await this.loadVersion(workflow.activeVersionId);
      const trigger = version?.graph.nodes.find((n) => n.type === "trigger");
      if (trigger && triggerMatches(trigger.data, event)) {
        await this.triggerWorkflow({ workflowId: workflow.id, contactId, projectId, event });
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

    // The cursor decides: a job for another step (redelivered after the run
    // moved on, or a duplicate) is dropped.
    if (execution.currentNodeId !== nodeId) {
      this.logger.debug("Stale workflow job dropped", {
        executionId,
        nodeId,
        currentNodeId: execution.currentNodeId,
      });
      return;
    }

    // A run reads only the version it started on: editing the workflow
    // never moves the ground under it.
    const version = execution.versionId ? await this.loadVersion(execution.versionId) : null;
    const node = version?.graph.nodes.find((n) => n.id === nodeId);
    if (!version || !node) {
      this.logger.error("Workflow run cannot continue: no version or no such step in it", {
        executionId,
        nodeId,
        versionId: execution.versionId,
      });
      // Ended rather than left RUNNING: a RUNNING row blocks the contact from entering again.
      await this.executionRepo.finish(executionId, { status: "FAILED", exitReason: "invalid_run", from: nodeId });
      return;
    }

    // Each step runs at most once per run. A redelivered job whose step is
    // already COMPLETED only moves the cursor on, along the branch it took.
    const step = await this.executionRepo.claimStep(executionId, nodeId);
    if (step.status === "COMPLETED") {
      const branch = typeof step.result?.branch === "string" ? step.result.branch : undefined;
      await this.advance(executionId, version, nodeId, branch);
      return;
    }

    try {
      let branch: string | undefined;

      switch (node.type) {
        case "action":
          // The key makes a redelivered send reuse the first one's log and job.
          await this.handleEmailAction(execution, node.data, `wf-${executionId}-${nodeId}`);
          break;

        case "condition":
          branch = await this.handleApiCondition(execution, node.data, baseUrl);
          break;

        case "delay":
          // The job was queued with the delay, so if we are here, it is over.
          break;

        case "update_contact":
          await this.handleUpdateContactAction(execution, node.data);
          break;

        case "exit":
          await this.executionRepo.finish(executionId, {
            status: "COMPLETED",
            exitReason: "exit_node",
            from: nodeId,
            completeStep: { id: step.id },
          });
          return;

        default:
          throw new Error(`Unknown step type "${node.type}"`);
      }

      await this.advance(executionId, version, nodeId, branch, {
        id: step.id,
        result: branch ? { branch } : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error("Workflow step failed", { executionId, nodeId, error: message });
      await this.executionRepo.updateStepExecution(step.id, {
        status: "FAILED",
        result: { error: message },
        completedAt: new Date(),
      });
      // Ended, so the contact is not blocked from entering again.
      await this.executionRepo.finish(executionId, { status: "FAILED", exitReason: "error", from: nodeId });
    }
  }

  private async handleEmailAction(execution: WorkflowExecution, data: any, dedupeKey: string): Promise<void> {
    const campaignId = data.triggerId;
    if (!campaignId) throw new Error("No trigger chosen for the email step (triggerId)");

    const workflow = await this.workflowRepo.findById(execution.workflowId);
    if (!workflow) throw new Error("Workflow not found");

    const contact = await this.contactRepo.findById(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    await this.triggerService.sendTriggeredEmail({
      campaignId: Number(campaignId),
      projectId: workflow.projectId,
      to: contact.email,
      data: buildStepData(contact, execution.context),
      dedupeKey,
      locale: contact.locale || undefined,
    });
  }

  private async handleApiCondition(
    execution: WorkflowExecution,
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

    this.logger.debug("API Check request", {
      executionId: execution.id,
      contactId: contact.id,
      url,
    });

    // The URL is the user's: a shared instance refuses internal addresses
    // through the policy, redirects included.
    const response = await fetchWithPolicy(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          name: contact.name,
          locale: contact.locale ?? null,
          metadata: contact.meta,
          meta: contact.meta,
          // The trigger event, so the endpoint can decide on what happened.
          event: execution.context.event ?? null,
        }),
      },
      this.outbound,
    );

    const result = response.status === 200 ? "yes" : "no";
    this.logger.debug("API Check result", {
      executionId: execution.id,
      contactId: contact.id,
      result,
      status: response.status,
    });
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

  /**
   * Moves the run from `fromNodeId` to its next step (along `handle` after a
   * condition), or ends it when there is none; `completeStep` is marked done
   * in the same transaction. The cursor moves in the database first and the
   * job is queued after: a lost job is found by the sweeper from the row,
   * and a job for a step the run has left is dropped by `processStep`.
   */
  private async advance(
    executionId: number,
    version: WorkflowVersion,
    fromNodeId: string,
    handle?: string,
    completeStep?: CompleteStep,
  ): Promise<void> {
    const { nodes, edges } = version.graph;
    const outgoing = edges.filter(
      (e) => e.sourceNodeId === fromNodeId && (!handle || e.sourceHandle === handle),
    );
    if (outgoing.length > 1) {
      // Go-live refuses this; take the first rather than fork the run.
      this.logger.warn("Workflow step has more than one next step; following the first", {
        executionId,
        fromNodeId,
      });
    }
    const target = outgoing.length > 0 ? nodes.find((n) => n.id === outgoing[0].targetNodeId) : undefined;

    if (!target) {
      await this.executionRepo.finish(executionId, {
        status: "COMPLETED",
        exitReason: "completed",
        from: fromNodeId,
        completeStep,
      });
      return;
    }

    const delay = target.type === "delay" ? this.parseDelay(target.data) : 0;
    const moved = await this.executionRepo.moveCursor(executionId, {
      from: fromNodeId,
      to: target.id,
      wakeAt: new Date(Date.now() + delay),
      completeStep,
    });
    if (!moved) {
      this.logger.debug("Workflow run moved or ended meanwhile; not scheduling", { executionId, fromNodeId });
      return;
    }

    await this.automationQueue.add(
      `workflow-${executionId}-${target.id}`,
      { executionId, nodeId: target.id },
      // One job per run and step: adding it again (the sweeper, a retry) is a no-op while it exists.
      { delay, jobId: automationJobId(executionId, target.id) },
    );
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
