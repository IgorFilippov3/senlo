import { Queue } from "bullmq";
import {
  IWorkflowRepository,
  IWorkflowExecutionRepository,
  ContactRepository,
  IContactEventRepository,
  ITriggeredSendLogRepository,
  ISuppressionRepository,
  ContactBlockedListener,
  CompleteStep,
} from "../ports";
import { TriggerService } from "./triggerService";
import { AutomationJobData } from "../queue/types";
import type {
  ContactEvent,
  ExecutionContext,
  ExecutionExitReason,
  WorkflowExecution,
  WorkflowNodeStats,
  WorkflowRunStats,
  WorkflowVersion,
} from "../domain";
import { buildStepData } from "../workflow-step-data";
import type { WorkflowEvent } from "../workflow-events";
import {
  asDate,
  contactValue,
  evaluateConditions,
  lookupsOf,
  lookupKey,
  triggerAccepts,
  triggerFiltersOf,
  valueAt,
  type ConditionGroup,
  type ConditionSnapshot,
} from "../workflow-conditions";
import { ServiceHooks } from "../hooks";
import { consoleLogger, type Logger } from "../logger";
import { allowAllOutbound, fetchWithPolicy, OutboundRefusedError, type OutboundPolicy } from "../outbound";
import { AppError, NotFoundError, QuotaExceededError, RetryableStepError } from "../errors";
import { parseInput } from "../validation";
import { z } from "zod";

/** The queue job of a run's step; stable, so a second add of it is ignored. */
export function automationJobId(executionId: number, nodeId: string): string {
  return `wf-${executionId}-${nodeId}`;
}

/** A run whose step is due this long without its job is re-queued by the sweeper. */
export const SWEEP_GRACE_MS = 2 * 60 * 1000;

/** Runs the sweeper looks at per pass. */
export const SWEEP_BATCH_SIZE = 500;

/** Body of `POST /api/automations/cancel`. */
export const CancelRunsRequestSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email(),
  workflowId: z.number().int().positive().optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** A timeout job up to this early still ends the wait (clocks of the queue and the database). */
const WAIT_CLOCK_SLACK_MS = 1000;

/** Events a Wait for event step looks back through for one passing its filters. */
const WAIT_LOOKBACK_LIMIT = 50;

type LazyContact = () => Promise<ConditionSnapshot["contact"] | null>;

/** Reads the contact on first use, once. */
function lazyContact(read: () => Promise<ConditionSnapshot["contact"] | null>): LazyContact {
  let pending: Promise<ConditionSnapshot["contact"] | null> | undefined;
  return () => (pending ??= read());
}

/** Without a suppression repository nobody is blocked (the email worker still checks before sending). */
const noSendBlocks: Pick<ISuppressionRepository, "findSendBlock"> = { findSendBlock: async () => null };

const DURATION_MS: Record<string, number> = { minutes: 60_000, hours: 3_600_000, days: DAY_MS };

/** Without a send log repository no email was ever opened (a host that builds the service by hand). */
const noEngagement: Pick<ITriggeredSendLogRepository, "hasEngagement"> = { hasEngagement: async () => false };

/** How long the API check waits for the user's endpoint. */
export const API_CHECK_TIMEOUT_MS = 10_000;

/** What a step does when it fails for good (`node.data.onError`). */
export type StepOnError = "fail" | "continue";

/** Where a job is in its retries; the worker passes BullMQ's counters. */
export interface StepAttempt {
  /** Attempts made before this one. */
  attemptsMade: number;
  /** Attempts the job has in total. */
  attempts: number;
}

/** Versions one worker process keeps in memory. */
const VERSION_CACHE_SIZE = 500;

export class AutomationService {
  constructor(
    private readonly workflowRepo: IWorkflowRepository,
    private readonly executionRepo: IWorkflowExecutionRepository,
    private readonly contactRepo: ContactRepository,
    private readonly contactEvents: Pick<IContactEventRepository, "record" | "existsSince" | "listSince">,
    private readonly automationQueue: Queue<AutomationJobData>,
    private readonly triggerService: TriggerService,
    private readonly logger: Logger = consoleLogger,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
    /** Where the "API condition" node may POST; see `OutboundPolicy`. */
    private readonly outbound: OutboundPolicy = allowAllOutbound,
    /** Opens and clicks of an automation's emails, for email rules. */
    private readonly engagement: Pick<ITriggeredSendLogRepository, "hasEngagement"> = noEngagement,
    /** Unsubscribed and suppressed addresses: their email steps are skipped, lifecycle runs end. */
    private readonly sendBlocks: Pick<ISuppressionRepository, "findSendBlock"> = noSendBlocks,
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

    if (!(await this.mayEnter(workflowId, contactId, projectId, version))) return null;

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
      goalEvent: version.settings.goal?.event ?? null,
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

    await this.advance(execution, version, triggerNode.id);

    return execution;
  }

  /**
   * The version's entry rules, before a run starts: `once` lets a contact in
   * a single time ever; a cooldown not again within that time after their
   * last start. A lifecycle workflow does not start for a contact who
   * unsubscribed or is suppressed. A contact with a run in progress is
   * handled by the caller (one run at a time).
   */
  private async mayEnter(
    workflowId: number,
    contactId: number,
    projectId: number,
    version: WorkflowVersion,
  ): Promise<boolean> {
    const { entry, kind } = version.settings;
    if (entry?.mode === "once" || entry?.cooldown) {
      const last = await this.executionRepo.lastStartedAt(workflowId, contactId);
      if (last && entry.mode === "once") return false;
      if (last && entry.cooldown) {
        const window = entry.cooldown.duration * (DURATION_MS[entry.cooldown.unit] ?? 0);
        if (Date.now() - last.getTime() < window) return false;
      }
    }
    if (kind === "lifecycle") {
      const contact = await this.contactRepo.findById(contactId);
      if (!contact || (await this.sendBlocks.findSendBlock(projectId, contact.email))) return false;
    }
    return true;
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

    // The contact is read once, and only when a goal, wait or trigger has filters.
    const contact = lazyContact(() => this.contactSnapshot(contactId));
    await this.completeGoals(contactId, { name, payload }, contact);
    await this.resumeWaiting(contactId, { name, payload, eventId: event.id }, contact);
    await this.dispatchTriggers(projectId, contactId, { name, payload }, contact);
    return { event, duplicate: false };
  }

  /**
   * Starts every ACTIVE workflow of the project whose active version's
   * trigger accepts the event. The lookup goes through the trigger event
   * name copied onto the workflow (indexed), then the version's trigger node
   * decides on the rest: its filters on the contact and the event's payload
   * (`triggerAccepts`).
   */
  private async dispatchTriggers(
    projectId: number,
    contactId: number,
    event: WorkflowEvent,
    contact: LazyContact,
  ): Promise<void> {
    const workflows = await this.workflowRepo.findActiveByTrigger(projectId, event.name);
    for (const workflow of workflows) {
      if (!workflow.activeVersionId) continue;
      const version = await this.loadVersion(workflow.activeVersionId);
      const trigger = version?.graph.nodes.find((n) => n.type === "trigger");
      if (!trigger) continue;
      const snapshot = triggerFiltersOf(trigger.data) ? await contact() : null;
      if (triggerAccepts(trigger.data, event, snapshot ?? { email: "" })) {
        await this.triggerWorkflow({ workflowId: workflow.id, contactId, projectId, event });
      }
    }
  }

  /**
   * Goals first: every RUNNING run of the contact whose goal is this event
   * (and whose goal filters hold) ends COMPLETED with `goal`, wherever it is
   * (a delay, a wait), so the rest of its steps do not run.
   */
  private async completeGoals(contactId: number, event: WorkflowEvent, contact: LazyContact): Promise<void> {
    for (const run of await this.executionRepo.findByGoal(contactId, event.name)) {
      const version = run.versionId ? await this.loadVersion(run.versionId) : null;
      const filters = version?.settings.goal?.filters;
      if (filters && Array.isArray(filters.rules) && filters.rules.length > 0) {
        const snapshot = await contact();
        if (!snapshot || !evaluateConditions(filters, { contact: snapshot, event: event.payload, steps: run.context.steps })) {
          continue;
        }
      }
      if (await this.executionRepo.finish(run.id, { status: "COMPLETED", exitReason: "goal" })) {
        this.logger.info("Workflow run reached its goal", { executionId: run.id, event: event.name });
      }
    }
  }

  /**
   * Then the runs waiting for this event at a Wait for event step: the event
   * (if its filters hold) wins the wait against the timeout, its payload
   * becomes the step's output, and the run takes Yes.
   */
  private async resumeWaiting(
    contactId: number,
    event: WorkflowEvent & { eventId: number },
    contact: LazyContact,
  ): Promise<void> {
    for (const run of await this.executionRepo.findWaiting(contactId, event.name)) {
      const version = run.versionId ? await this.loadVersion(run.versionId) : null;
      const node = version?.graph.nodes.find((n) => n.id === run.currentNodeId);
      if (!version || !node || node.type !== "wait_event") continue;
      if (!(await this.waitFiltersHold(node.data, event.payload, run, contact))) continue;
      if (!(await this.executionRepo.resolveWait(run.id, { nodeId: node.id, event: event.name }))) continue;

      await this.executionRepo.setStepOutput(run.id, node.id, event.payload);
      const step = await this.executionRepo.claimStep(run.id, node.id);
      const fresh = (await this.executionRepo.findById(run.id)) ?? run;
      await this.advance(fresh, version, node.id, "yes", {
        id: step.id,
        result: { branch: "yes", eventId: event.eventId },
      });
    }
  }

  private async waitFiltersHold(
    data: Record<string, any>,
    payload: Record<string, unknown>,
    run: WorkflowExecution,
    contact: LazyContact,
  ): Promise<boolean> {
    const filters = data.filters as ConditionGroup | undefined;
    if (!filters || !Array.isArray(filters.rules) || filters.rules.length === 0) return true;
    const snapshot = await contact();
    return !!snapshot && evaluateConditions(filters, { contact: snapshot, event: payload, steps: run.context.steps });
  }

  /**
   * A Wait for event step. The contact may have done it already (since the
   * run started, or since the step started): then Yes at once. Otherwise the
   * run starts waiting and a timeout job is queued; the event (through
   * `resumeWaiting`) or the timeout (this step again, once due) ends the
   * wait, whichever wins the guarded update.
   */
  private async handleWaitEvent(
    execution: WorkflowExecution,
    node: { id: string; data: Record<string, any> },
    step: { startedAt: Date },
  ): Promise<"waiting" | { branch: "yes" | "no"; result: Record<string, unknown> }> {
    const event = node.data.event;
    if (typeof event !== "string" || event === "") throw new Error("Wait for event: no event chosen");
    const contact = lazyContact(() => this.contactSnapshot(execution.contactId));

    if (execution.waitingEvent === event) {
      // Already waiting: the timeout job, or an early copy of a job.
      if (execution.wakeAt && execution.wakeAt.getTime() > Date.now() + WAIT_CLOCK_SLACK_MS) return "waiting";
      if (!(await this.executionRepo.resolveWait(execution.id, { nodeId: node.id, event }))) return "waiting";
      return { branch: "no", result: { branch: "no", timedOut: true } };
    }

    const since = node.data.since === "step_start" ? step.startedAt : execution.startedAt;
    const done = await this.findDoneEvent(execution, node, event, since, contact);
    if (done) {
      await this.executionRepo.setStepOutput(execution.id, node.id, done.payload);
      return { branch: "yes", result: { branch: "yes", eventId: done.id } };
    }

    const timeout = this.parseDelay(node.data.timeout ?? {});
    if (timeout <= 0) throw new Error("Wait for event: no timeout");
    const wakeAt = new Date(Date.now() + timeout);
    if (!(await this.executionRepo.startWait(execution.id, { nodeId: node.id, event, wakeAt }))) return "waiting";

    // The event may have come between the look above and the wait: look once more.
    const raced = await this.findDoneEvent(execution, node, event, since, contact);
    if (raced && (await this.executionRepo.resolveWait(execution.id, { nodeId: node.id, event }))) {
      await this.executionRepo.setStepOutput(execution.id, node.id, raced.payload);
      return { branch: "yes", result: { branch: "yes", eventId: raced.id } };
    }

    await this.automationQueue.add(
      `workflow-${execution.id}-${node.id}-timeout`,
      { executionId: execution.id, nodeId: node.id },
      { delay: timeout, jobId: `${automationJobId(execution.id, node.id)}-timeout` },
    );
    return "waiting";
  }

  /** The newest `event` since `since` that passes the step's filters. */
  private async findDoneEvent(
    execution: WorkflowExecution,
    node: { data: Record<string, any> },
    event: string,
    since: Date,
    contact: LazyContact,
  ): Promise<ContactEvent | null> {
    const events = await this.contactEvents.listSince(execution.contactId, event, since, WAIT_LOOKBACK_LIMIT);
    for (const candidate of events) {
      if (await this.waitFiltersHold(node.data, candidate.payload, execution, contact)) return candidate;
    }
    return null;
  }


  /**
   * Process a single step in a workflow execution.
   */
  async processStep(
    executionId: number,
    nodeId: string,
    baseUrl: string,
    attempt: StepAttempt = { attemptsMade: 0, attempts: 1 },
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
    if (step.status === "COMPLETED" || step.status === "SKIPPED") {
      const branch = typeof step.result?.branch === "string" ? step.result.branch : undefined;
      await this.advance(execution, version, nodeId, branch);
      return;
    }

    try {
      let branch: string | undefined;
      let result: Record<string, unknown> | null = null;

      switch (node.type) {
        case "action": {
          // The key makes a redelivered send reuse the first one's log and job.
          const sent = await this.handleEmailAction(execution, node.data, `wf-${executionId}-${nodeId}`);
          if ("blocked" in sent) {
            // The contact may not get mail (D5): a lifecycle run ends, a
            // transactional one skips the email and goes on.
            const skipped = { id: step.id, status: "SKIPPED" as const, result: { skipped: sent.blocked } };
            if (version.settings.kind === "lifecycle") {
              await this.executionRepo.finish(executionId, {
                status: "CANCELLED",
                exitReason: sent.blocked === "UNSUBSCRIBE" ? "unsubscribed" : "suppressed",
                from: nodeId,
                completeStep: skipped,
              });
            } else {
              await this.advance(execution, version, nodeId, undefined, skipped);
            }
            return;
          }
          result = sent.sendLogId !== null ? { sendLogId: sent.sendLogId } : null;
          break;
        }

        case "condition":
          if (node.data.mode === "rules") {
            const outcome = await this.handleRuleCondition(execution, node.data);
            branch = outcome.branch;
            result = { branch, matched: outcome.matched };
          } else if (node.data.mode === "api") {
            branch = await this.handleApiCondition(execution, node.data, baseUrl);
          } else {
            throw new Error('Condition step has no mode ("rules" or "api")');
          }
          break;

        case "delay":
          // The job was queued with the delay, so if we are here, it is over.
          // A "wait until" step checks its date now: a missing or unreadable
          // one is an error of this step (its onError applies).
          if (node.data.mode === "until") {
            const until = await this.untilTime(execution, node.data.until);
            result = { until: until.toISOString() };
          }
          break;

        case "wait_event": {
          const outcome = await this.handleWaitEvent(execution, node, step);
          if (outcome === "waiting") return;
          branch = outcome.branch;
          result = outcome.result;
          break;
        }

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

      await this.advance(execution, version, nodeId, branch, {
        id: step.id,
        result: result ?? (branch ? { branch } : null),
      });
    } catch (error) {
      await this.handleStepError(execution, version, node, step.id, error, attempt);
    }
  }

  /**
   * A step threw. A retryable error before the last attempt is rethrown, so
   * BullMQ runs the job again with backoff (the step row stays PENDING with
   * the error, the cursor stays). Otherwise the step's `onError` decides:
   * "fail" (the default) ends the run FAILED; "continue" sends a condition
   * down its No branch and skips any other step. A plan refusal always
   * fails the run.
   */
  private async handleStepError(
    execution: WorkflowExecution,
    version: WorkflowVersion,
    node: { id: string; type: string; data: Record<string, any> },
    stepId: number,
    error: unknown,
    attempt: StepAttempt,
  ): Promise<void> {
    const executionId = execution.id;
    const message = error instanceof Error ? error.message : String(error);
    const retryable = error instanceof RetryableStepError;
    const lastAttempt = attempt.attemptsMade + 1 >= attempt.attempts;

    if (retryable && !lastAttempt) {
      this.logger.warn("Workflow step failed, will retry", {
        executionId,
        nodeId: node.id,
        attempt: attempt.attemptsMade + 1,
        of: attempt.attempts,
        error: message,
      });
      await this.executionRepo.updateStepExecution(stepId, {
        result: { error: message, attempts: attempt.attemptsMade + 1 },
      });
      throw error;
    }

    const onError: StepOnError =
      node.data.onError === "continue" && !(error instanceof QuotaExceededError) ? "continue" : "fail";

    if (onError === "continue" && node.type !== "exit") {
      this.logger.warn("Workflow step failed; continuing (onError: continue)", {
        executionId,
        nodeId: node.id,
        error: message,
      });
      if (node.type === "condition") {
        await this.advance(execution, version, node.id, "no", {
          id: stepId,
          result: { branch: "no", error: message },
        });
      } else {
        await this.advance(execution, version, node.id, undefined, {
          id: stepId,
          status: "SKIPPED",
          result: { skipped: "error", error: message },
        });
      }
      return;
    }

    this.logger.error("Workflow step failed", { executionId, nodeId: node.id, error: message, retryable });
    await this.executionRepo.updateStepExecution(stepId, {
      status: "FAILED",
      result: { error: message },
      completedAt: new Date(),
    });
    // Ended, so the contact is not blocked from entering again.
    await this.executionRepo.finish(executionId, { status: "FAILED", exitReason: "error", from: node.id });
  }

  /**
   * Ends a run whose job ran out of attempts on an error `processStep` did
   * not handle (the database unreachable before the step started). Called by
   * the worker; a run that moved on or ended meanwhile is left alone.
   */
  async failExhaustedRun(executionId: number, nodeId: string, error: string): Promise<void> {
    const ended = await this.executionRepo.finish(executionId, { status: "FAILED", exitReason: "error", from: nodeId });
    if (ended) this.logger.error("Workflow run failed: its job ran out of attempts", { executionId, nodeId, error });
  }

  /**
   * Sends the step's email: the send log id, kept in the step result for
   * email rules, or why the contact may not get it.
   */
  private async handleEmailAction(
    execution: WorkflowExecution,
    data: any,
    dedupeKey: string,
  ): Promise<{ sendLogId: number | null } | { blocked: "UNSUBSCRIBE" | "BOUNCE" | "SPAM" }> {
    const campaignId = data.triggerId;
    if (!campaignId) throw new Error("No trigger chosen for the email step (triggerId)");

    const workflow = await this.workflowRepo.findById(execution.workflowId);
    if (!workflow) throw new Error("Workflow not found");

    const contact = await this.contactRepo.findById(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    const block = await this.sendBlocks.findSendBlock(workflow.projectId, contact.email);
    if (block) return { blocked: block.reason };

    const sendLogId = await this.sendStepEmail({
      campaignId: Number(campaignId),
      projectId: workflow.projectId,
      to: contact.email,
      data: buildStepData(contact, execution.context),
      dedupeKey,
      locale: contact.locale || undefined,
    });
    return { sendLogId };
  }

  /**
   * The send behind an email step. The service's own refusals (missing
   * trigger, no provider, plan limit) are permanent; anything else (the
   * database or the queue unreachable) may pass and is retried. The dedupe
   * key makes a retry safe.
   */
  private async sendStepEmail(options: Parameters<TriggerService["sendTriggeredEmail"]>[0]): Promise<number | null> {
    try {
      const sent = await this.triggerService.sendTriggeredEmail(options);
      return typeof sent?.logId === "number" ? sent.logId : null;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new RetryableStepError(`Email step could not queue the send: ${error instanceof Error ? error.message : String(error)}`);
    }
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
    // through the policy, redirects included. A refusal or a malformed URL is
    // permanent; a network failure or a timeout may pass and is retried.
    let response: Response;
    try {
      response = await fetchWithPolicy(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(API_CHECK_TIMEOUT_MS),
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
    } catch (error) {
      if (error instanceof OutboundRefusedError) throw error;
      const name = error instanceof Error ? error.name : "";
      if (error instanceof TypeError || name === "TimeoutError" || name === "AbortError") {
        throw new RetryableStepError(`API check request failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }
    // Only the status is read.
    await response.body?.cancel().catch(() => {});

    // The endpoint is down or asks to slow down: try again rather than take "no".
    if (response.status >= 500 || response.status === 429) {
      throw new RetryableStepError(`API check answered ${response.status}`);
    }

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
    run: WorkflowExecution,
    version: WorkflowVersion,
    fromNodeId: string,
    handle?: string,
    completeStep?: CompleteStep,
  ): Promise<void> {
    const executionId = run.id;
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

    const delay = target.type === "delay" ? await this.delayOf(run, target.data) : 0;
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

  /**
   * How long to wait before a delay step: its duration ("for", the default),
   * or until a date read from the trigger event or the contact ("until"),
   * with an offset. A date in the past waits nothing. An unreadable date
   * waits nothing either: the step itself then fails on it, so its
   * `onError` applies there.
   */
  private async delayOf(run: WorkflowExecution, data: Record<string, any>): Promise<number> {
    if (data.mode !== "until") return this.parseDelay(data);
    try {
      return Math.max(0, (await this.untilTime(run, data.until)).getTime() - Date.now());
    } catch {
      return 0;
    }
  }

  /** The date a "wait until" step waits for: the field's date plus or minus the offset. */
  private async untilTime(run: WorkflowExecution, until: any): Promise<Date> {
    if (!until || (until.source !== "event" && until.source !== "contact") || typeof until.path !== "string") {
      throw new Error("Wait until: no date field chosen");
    }
    let raw: unknown;
    if (until.source === "event") {
      raw = valueAt(run.context.event?.payload ?? {}, until.path);
    } else {
      const contact = await this.contactSnapshot(run.contactId);
      if (!contact) throw new Error("Contact not found");
      raw = contactValue(contact, until.path);
    }
    const at = asDate(raw);
    if (at === null) {
      throw new Error(`Wait until: ${until.source}.${until.path} is ${raw === undefined ? "missing" : "not a date"}`);
    }
    const offset = until.offset ? this.parseDelay(until.offset) : 0;
    return new Date(until.offset?.direction === "before" ? at - offset : at + offset);
  }

  /** The contact as conditions read it, or null when it is gone. */
  private async contactSnapshot(contactId: number): Promise<ConditionSnapshot["contact"] | null> {
    const contact = await this.contactRepo.findById(contactId);
    if (!contact) return null;
    return {
      email: contact.email,
      name: contact.name ?? null,
      locale: contact.locale ?? null,
      unsubscribed: Boolean((contact as { unsubscribed?: boolean }).unsubscribed),
      meta: (contact.meta as Record<string, unknown> | null) ?? {},
    };
  }

  /**
   * A Condition step in rules mode: the contact, the trigger event, step
   * outputs, and the history lookups the rules need, then Yes or No. The
   * step result keeps the branch and whether the rules matched.
   */
  private async handleRuleCondition(
    execution: WorkflowExecution,
    data: Record<string, any>,
  ): Promise<{ branch: "yes" | "no"; matched: boolean }> {
    const group = data.conditions as ConditionGroup | undefined;
    if (!group || !Array.isArray(group.rules)) throw new Error("Condition has no rules");
    const contact = await this.contactSnapshot(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    const lookups = new Map<string, boolean>();
    for (const rule of lookupsOf(group)) {
      if (rule.source === "history") {
        const since = rule.withinDays ? new Date(Date.now() - rule.withinDays * DAY_MS) : new Date(0);
        lookups.set(lookupKey(rule), await this.contactEvents.existsSince(execution.contactId, rule.event, since));
      } else {
        lookups.set(lookupKey(rule), await this.emailEngagement(execution.id, rule.nodeId, rule.state));
      }
    }

    const matched = evaluateConditions(group, {
      contact,
      event: execution.context.event?.payload ?? {},
      steps: execution.context.steps,
      lookups,
    });
    return { branch: matched ? "yes" : "no", matched };
  }

  /**
   * Whether the email an email step of this run sent was opened / clicked.
   * A step the run did not pass through (another branch) sent nothing: no.
   */
  private async emailEngagement(executionId: number, nodeId: string, state: string): Promise<boolean> {
    const steps = await this.executionRepo.getStepExecutions(executionId);
    const sendLogId = steps.find((s) => s.nodeId === nodeId)?.result?.sendLogId;
    if (typeof sendLogId !== "number") return false;
    return this.engagement.hasEngagement(sendLogId, state.endsWith("clicked") ? "CLICK" : "OPEN");
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

  /**
   * The sweeper (every few minutes, `maintenance-queue`): re-queues the job
   * of each RUNNING run whose step was due more than `SWEEP_GRACE_MS` ago and
   * has no job waiting, delayed or running. That is a job lost to a Redis
   * restart, or to a crash between the cursor move and the queue add. The
   * job id is the run's and step's, so a job still in the queue is left as
   * is; a job that failed for good is replaced. A stale one is dropped by
   * `processStep` through the cursor.
   */
  async recoverDueRuns(now: Date = new Date()): Promise<{ checked: number; requeued: number }> {
    const due = await this.executionRepo.findDue(new Date(now.getTime() - SWEEP_GRACE_MS), SWEEP_BATCH_SIZE);
    let requeued = 0;
    for (const run of due) {
      const jobId = automationJobId(run.id, run.currentNodeId);
      const existing = await this.automationQueue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state !== "failed" && state !== "completed" && state !== "unknown") continue;
        await existing.remove();
      }
      await this.automationQueue.add(
        `workflow-${run.id}-${run.currentNodeId}`,
        { executionId: run.id, nodeId: run.currentNodeId },
        { jobId },
      );
      requeued += 1;
    }
    if (requeued > 0) this.logger.warn("Sweeper re-queued workflow runs", { requeued, checked: due.length });
    return { checked: due.length, requeued };
  }

  /**
   * `POST /api/automations/cancel`: cancels the contact's RUNNING runs in
   * the project (of one workflow, when `workflowId` is given). The contact
   * and the workflow must belong to the API key's project.
   */
  async cancelFromRequest(projectId: number, rawBody: unknown): Promise<{ cancelled: number }> {
    const req = parseInput(CancelRunsRequestSchema, rawBody);
    const contact = await this.contactRepo.findByEmail(projectId, req.email);
    if (!contact) throw new NotFoundError("Contact");
    if (req.workflowId !== undefined) {
      const workflow = await this.workflowRepo.findById(req.workflowId);
      if (!workflow || workflow.projectId !== projectId) throw new NotFoundError("Workflow");
    }
    const ids = await this.cancelContactRuns(contact.id, { workflowId: req.workflowId, exitReason: "cancelled_api" });
    return { cancelled: ids.length };
  }

  /** Cancels a contact's RUNNING runs; their queued jobs are dropped when they come. */
  async cancelContactRuns(
    contactId: number,
    options: { workflowId?: number; exitReason: ExecutionExitReason },
  ): Promise<number[]> {
    const ids = await this.executionRepo.cancelRunning(contactId, options);
    if (ids.length > 0) this.logger.info("Workflow runs cancelled", { contactId, runs: ids, reason: options.exitReason });
    return ids;
  }

  async getWorkflowStats(workflowId: number): Promise<WorkflowNodeStats[]> {
    return this.executionRepo.getNodeStats(workflowId);
  }

  /** The workflow's runs by outcome; conversion is `goal / started`. */
  async getRunStats(workflowId: number): Promise<WorkflowRunStats> {
    return this.executionRepo.getRunStats(workflowId);
  }

  /**
   * A contact may no longer get mail (unsubscribed, bounced, reported as
   * spam): their lifecycle runs end at once (D5). Transactional runs go on;
   * their email steps skip the address. Wired as the `ContactBlockedListener`
   * of the unsubscribe and webhook services and the email worker.
   */
  readonly onContactBlocked: ContactBlockedListener = async ({ projectId, email, reason }) => {
    const contact = await this.contactRepo.findByEmail(projectId, email);
    if (!contact) return;
    const ids = await this.executionRepo.cancelRunning(contact.id, {
      exitReason: reason === "UNSUBSCRIBE" ? "unsubscribed" : "suppressed",
      lifecycleOnly: true,
    });
    if (ids.length > 0) this.logger.info("Lifecycle runs ended: the contact may no longer get mail", { contactId: contact.id, runs: ids, reason });
  };
}
