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
  IProjectRepository,
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
import { isBranchingType } from "../workflow-graph";
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
import { AppError, NotFoundError, QuotaExceededError, RetryableStepError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { z } from "zod";
import type { StepAttempt, StepContext, StepHandler, StepOutcome } from "../workflow-steps";
import {
  HTTP_RESPONSE_BODY_LIMIT,
  HTTP_STEP_DEFAULT_TIMEOUT_S,
  httpMethodHasBody,
  validateHttpStep,
  type HttpStepData,
  type HttpStepOutput,
} from "../workflow-http";

export type { StepAttempt } from "../workflow-steps";

/**
 * The queue job of a run's step; stable, so a second add of it is ignored.
 * A restarted run's later passes (generation > 0) get their own ids, so a
 * job of an earlier pass never stands in for one of the new pass.
 */
export function automationJobId(executionId: number, nodeId: string, generation = 0): string {
  return generation > 0 ? `wf-${executionId}-g${generation}-${nodeId}` : `wf-${executionId}-${nodeId}`;
}

/** A step's job data; the generation only once a run was restarted, so the first pass's jobs look as before. */
function jobData(executionId: number, nodeId: string, generation = 0): AutomationJobData {
  return generation > 0 ? { executionId, nodeId, generation } : { executionId, nodeId };
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

/** A test run waits for an event at most this long (the step's timeout is cut to it). */
export const TEST_RUN_WAIT_CAP_MS = 60_000;

/**
 * Reads a response body up to `HTTP_RESPONSE_BODY_LIMIT` bytes: JSON when it
 * parses, else text; a longer body is cut, kept as text and flagged.
 */
export async function readLimitedBody(response: Response): Promise<{ body: unknown; truncated?: boolean }> {
  if (!response.body) return { body: null };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > HTTP_RESPONSE_BODY_LIMIT) {
      chunks.push(value.subarray(0, HTTP_RESPONSE_BODY_LIMIT - size));
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (truncated) return { body: text, truncated: true };
  if (text.trim() === "") return { body: null };
  try {
    return { body: JSON.parse(text) };
  } catch {
    return { body: text };
  }
}

/**
 * Fills `{{path}}` merge tags in a JSON template with values from `data`
 * (`contact.*`, `event.*`, `steps.*`): inside a string literal the value is
 * escaped as string content, outside it is written as a JSON value (`null`
 * when missing), so `{"total": {{event.total}}}` keeps its number.
 */
export function fillJsonTemplate(template: string, data: Record<string, unknown>): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === "{" && template[i + 1] === "{") {
      const close = template.indexOf("}}", i + 2);
      if (close !== -1) {
        const value = valueAt(data, template.slice(i + 2, close).trim());
        if (inString) {
          const text = value === undefined || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
          out += JSON.stringify(text).slice(1, -1);
        } else {
          out += value === undefined ? "null" : JSON.stringify(value);
        }
        i = close + 2;
        continue;
      }
    }
    if (inString && ch === "\\") {
      out += ch + (template[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (ch === '"') inString = !inString;
    out += ch;
    i += 1;
  }
  return out;
}

/** Versions one worker process keeps in memory. */
const VERSION_CACHE_SIZE = 500;

/** Where the frequency cap comes from (`createServices` passes both). */
export interface AutomationLimits {
  projects?: Pick<IProjectRepository, "findById">;
  sendCounts?: Pick<ITriggeredSendLogRepository, "countAutomationSends">;
}

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
    /** The project's frequency cap and the count it is checked against; without them nothing is capped. */
    private readonly limits: AutomationLimits = {},
  ) {
    for (const handler of this.builtinHandlers()) this.handlers.set(handler.type, handler);
  }

  /** What each step type does, by node type. */
  private readonly handlers = new Map<string, StepHandler>();

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
      if (version.settings.entry?.mode !== "restart") return existing;
      // D4: the same run back to the start with the new event; not a new run, not counted again.
      const restarted = await this.restartRun(existing, version, triggerNode.id, event);
      if (restarted) return restarted;
      // It ended meanwhile: a new run below.
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
   * `restart` entry: the contact's run in progress goes back to the trigger
   * step of the active version with the new event and empty step outputs,
   * as its next generation (a new pass with its own step rows). Jobs of the
   * earlier pass are dropped when they come; a wait it was in ends.
   */
  private async restartRun(
    run: WorkflowExecution,
    version: WorkflowVersion,
    triggerNodeId: string,
    event?: WorkflowEvent,
  ): Promise<WorkflowExecution | null> {
    const restarted = await this.executionRepo.restart(run.id, {
      versionId: version.id,
      context: { ...(event ? { event: { name: event.name, payload: event.payload } } : {}), steps: {} },
      currentNodeId: triggerNodeId,
      goalEvent: version.settings.goal?.event ?? null,
    });
    if (!restarted) return null;
    this.logger.info("Workflow run restarted by a new trigger event", {
      executionId: run.id,
      generation: restarted.generation ?? 0,
    });
    await this.advance(restarted, version, triggerNodeId);
    return restarted;
  }

  /**
   * A test run (from the builder): `version` is a test snapshot of the
   * draft. The workflow need not be live; entry rules, the plan's run quota
   * and the one-run-per-contact rule do not apply. Emails are real sends
   * (counted as sends). Delays are skipped and a wait for an event lasts at
   * most `TEST_RUN_WAIT_CAP_MS`. Left out of the workflow's statistics.
   */
  async startTestRun(options: {
    workflowId: number;
    contactId: number;
    version: WorkflowVersion;
    event: WorkflowEvent;
  }): Promise<WorkflowExecution> {
    const { workflowId, contactId, version, event } = options;
    const triggerNode = version.graph.nodes.find((n) => n.type === "trigger");
    if (!triggerNode) throw new ValidationError("The automation has no trigger step");
    this.versions.set(version.id, version);
    const execution = await this.executionRepo.create({
      workflowId,
      contactId,
      versionId: version.id,
      context: { event: { name: event.name, payload: event.payload }, steps: {} },
      currentNodeId: triggerNode.id,
      goalEvent: version.settings.goal?.event ?? null,
      isTest: true,
    });
    if (!execution) throw new Error("Test run could not be created");
    this.logger.info("Workflow test run started", { executionId: execution.id, workflowId, contactId });
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
      const step = await this.executionRepo.claimStep(run.id, node.id, run.generation ?? 0);
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
  ): Promise<StepOutcome> {
    const event = node.data.event;
    if (typeof event !== "string" || event === "") throw new Error("Wait for event: no event chosen");
    const contact = lazyContact(() => this.contactSnapshot(execution.contactId));

    if (execution.waitingEvent === event) {
      // Already waiting: the timeout job, or an early copy of a job.
      if (execution.wakeAt && execution.wakeAt.getTime() > Date.now() + WAIT_CLOCK_SLACK_MS) return { kind: "waiting" };
      if (!(await this.executionRepo.resolveWait(execution.id, { nodeId: node.id, event }))) return { kind: "waiting" };
      return { kind: "done", branch: "no", result: { branch: "no", timedOut: true } };
    }

    const since = node.data.since === "step_start" ? step.startedAt : execution.startedAt;
    const done = await this.findDoneEvent(execution, node, event, since, contact);
    if (done) {
      return { kind: "done", branch: "yes", output: done.payload, result: { branch: "yes", eventId: done.id } };
    }

    const configured = this.parseDelay(node.data.timeout ?? {});
    if (configured <= 0) throw new Error("Wait for event: no timeout");
    const timeout = execution.isTest ? Math.min(configured, TEST_RUN_WAIT_CAP_MS) : configured;
    const wakeAt = new Date(Date.now() + timeout);
    if (!(await this.executionRepo.startWait(execution.id, { nodeId: node.id, event, wakeAt }))) return { kind: "waiting" };

    // The event may have come between the look above and the wait: look once more.
    const raced = await this.findDoneEvent(execution, node, event, since, contact);
    if (raced && (await this.executionRepo.resolveWait(execution.id, { nodeId: node.id, event }))) {
      return { kind: "done", branch: "yes", output: raced.payload, result: { branch: "yes", eventId: raced.id } };
    }

    const generation = execution.generation ?? 0;
    await this.automationQueue.add(
      `workflow-${execution.id}-${node.id}-timeout`,
      jobData(execution.id, node.id, generation),
      { delay: timeout, jobId: `${automationJobId(execution.id, node.id, generation)}-timeout` },
    );
    return { kind: "waiting" };
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


  /** Adds a step type, or replaces a built-in one: a new channel is a new handler (see `StepHandler`). */
  registerStepHandler(handler: StepHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Process a single step in a workflow execution. `generation` is the run's
   * generation the job was queued for: a job from before a restart is dropped.
   */
  async processStep(
    executionId: number,
    nodeId: string,
    baseUrl: string,
    attempt: StepAttempt = { attemptsMade: 0, attempts: 1 },
    generation = 0,
  ): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution || execution.status !== "RUNNING") return;

    // The cursor decides: a job for another step (redelivered after the run
    // moved on, or a duplicate) is dropped, and so is one from an earlier
    // pass of a restarted run.
    if (execution.currentNodeId !== nodeId || (execution.generation ?? 0) !== generation) {
      this.logger.debug("Stale workflow job dropped", {
        executionId,
        nodeId,
        currentNodeId: execution.currentNodeId,
        generation,
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

    // Each step runs at most once per run (and generation). A redelivered
    // job whose step is already COMPLETED only moves the cursor on, along the
    // branch it took.
    const step = await this.executionRepo.claimStep(executionId, nodeId, generation);
    if (step.status === "COMPLETED" || step.status === "SKIPPED") {
      const branch = typeof step.result?.branch === "string" ? step.result.branch : undefined;
      await this.advance(execution, version, nodeId, branch);
      return;
    }

    try {
      const handler = this.handlers.get(node.type);
      if (!handler) throw new Error(`Unknown step type "${node.type}"`);
      const outcome = await handler.run({
        run: execution,
        version,
        node,
        step,
        contact: lazyContact(() => this.contactSnapshot(execution.contactId)),
        dedupeKey: automationJobId(executionId, nodeId, generation),
        attempt,
        baseUrl,
        logger: this.logger,
      });
      await this.applyOutcome(execution, version, node.id, step.id, outcome);
    } catch (error) {
      await this.handleStepError(execution, version, node, step.id, error, attempt);
    }
  }

  /** What the engine does with a handler's outcome: the same for every step type. */
  private async applyOutcome(
    execution: WorkflowExecution,
    version: WorkflowVersion,
    nodeId: string,
    stepId: number,
    outcome: StepOutcome,
  ): Promise<void> {
    switch (outcome.kind) {
      case "waiting":
        return;
      case "end":
        await this.executionRepo.finish(execution.id, {
          status: outcome.status,
          exitReason: outcome.exitReason,
          from: nodeId,
          completeStep: { id: stepId, status: outcome.stepStatus, result: outcome.result },
        });
        return;
      case "skipped":
        await this.advance(execution, version, nodeId, undefined, {
          id: stepId,
          status: "SKIPPED",
          result: { ...(outcome.result ?? {}), skipped: outcome.reason },
        });
        return;
      case "done": {
        if (outcome.output !== undefined) await this.executionRepo.setStepOutput(execution.id, nodeId, outcome.output);
        const branch = outcome.branch;
        await this.advance(execution, version, nodeId, branch, {
          id: stepId,
          result: outcome.result ?? (branch ? { branch } : null),
        });
        return;
      }
    }
  }

  /** The built-in step types, as handlers. */
  private builtinHandlers(): StepHandler[] {
    return [
      { type: "action", recipient: "contact", run: (ctx) => this.runEmailStep(ctx) },
      { type: "http_request", recipient: "outward", run: (ctx) => this.runHttpStep(ctx) },
      { type: "condition", recipient: "none", run: (ctx) => this.runConditionStep(ctx) },
      { type: "delay", recipient: "none", run: (ctx) => this.runDelayStep(ctx) },
      { type: "wait_event", recipient: "none", run: (ctx) => this.handleWaitEvent(ctx.run, ctx.node, ctx.step) },
      {
        type: "update_contact",
        recipient: "none",
        run: async (ctx) => {
          await this.handleUpdateContactAction(ctx.run, ctx.node.data);
          return { kind: "done" };
        },
      },
      {
        type: "exit",
        recipient: "none",
        run: async () => ({ kind: "end", status: "COMPLETED", exitReason: "exit_node" }),
      },
    ];
  }

  /**
   * An email step. The contact may not get mail (D5): a lifecycle run ends,
   * a transactional one skips the email and goes on. Over the project's
   * frequency cap the email is skipped too (`frequency_cap`) and the run goes
   * on; a test run is not capped.
   */
  private async runEmailStep(ctx: StepContext): Promise<StepOutcome> {
    const { run: execution, node, version } = ctx;
    const campaignId = node.data.triggerId;
    if (!campaignId) throw new Error("No trigger chosen for the email step (triggerId)");

    const workflow = await this.workflowRepo.findById(execution.workflowId);
    if (!workflow) throw new Error("Workflow not found");

    const contact = await this.contactRepo.findById(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    const block = await this.sendBlocks.findSendBlock(workflow.projectId, contact.email);
    if (block) {
      if (version.settings.kind === "lifecycle") {
        return {
          kind: "end",
          status: "CANCELLED",
          exitReason: block.reason === "UNSUBSCRIBE" ? "unsubscribed" : "suppressed",
          stepStatus: "SKIPPED",
          result: { skipped: block.reason },
        };
      }
      return { kind: "skipped", reason: block.reason };
    }

    if (!execution.isTest && (await this.overFrequencyCap(workflow.projectId, contact.email))) {
      return { kind: "skipped", reason: "frequency_cap" };
    }

    // The key makes a redelivered send reuse the first one's log and job.
    const sendLogId = await this.sendStepEmail({
      campaignId: Number(campaignId),
      projectId: workflow.projectId,
      to: contact.email,
      data: buildStepData(contact, execution.context),
      dedupeKey: ctx.dedupeKey,
      locale: contact.locale || undefined,
      workflowExecutionId: execution.id,
    });
    return { kind: "done", result: sendLogId !== null ? { sendLogId } : null };
  }

  /** Whether the project's cap on automation emails per contact is reached for `email`. */
  private async overFrequencyCap(projectId: number, email: string): Promise<boolean> {
    if (!this.limits.projects || !this.limits.sendCounts) return false;
    const project = await this.limits.projects.findById(projectId);
    const cap = project?.automationSettings?.frequencyCap;
    if (!cap || !(cap.emails > 0) || !(cap.days > 0)) return false;
    const since = new Date(Date.now() - cap.days * DAY_MS);
    return (await this.limits.sendCounts.countAutomationSends(projectId, email, since)) >= cap.emails;
  }

  /** A Condition step: by rules, or by the user's API. */
  private async runConditionStep(ctx: StepContext): Promise<StepOutcome> {
    const { run: execution, node } = ctx;
    if (node.data.mode === "rules") {
      const outcome = await this.handleRuleCondition(execution, node.data);
      return { kind: "done", branch: outcome.branch, result: { branch: outcome.branch, matched: outcome.matched } };
    }
    if (node.data.mode === "api") {
      const { branch, output } = await this.handleApiCondition(execution, node.data, ctx.baseUrl);
      return { kind: "done", branch, output, result: { branch, status: output.status } };
    }
    throw new Error('Condition step has no mode ("rules" or "api")');
  }

  /**
   * A Wait step. The job was queued with the delay, so if we are here, it is
   * over. A "wait until" step checks its date now: a missing or unreadable
   * one is an error of this step (its onError applies).
   */
  private async runDelayStep(ctx: StepContext): Promise<StepOutcome> {
    if (ctx.node.data.mode !== "until") return { kind: "done" };
    const until = await this.untilTime(ctx.run, ctx.node.data.until);
    return {
      kind: "done",
      result: { until: until.toISOString(), ...(ctx.run.isTest ? { skippedForTest: true } : {}) },
    };
  }

  /**
   * A step threw. A retryable error before the last attempt is rethrown, so
   * BullMQ runs the job again with backoff (the step row stays PENDING with
   * the error, the cursor stays). Otherwise the step's `onError` decides:
   * "fail" (the default) ends the run FAILED; "continue" sends a branching
   * step (Condition, Wait for event) down its No branch and skips any other. A plan refusal always
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
      if (isBranchingType(node.type)) {
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

  /**
   * A request to a user's URL, through the outbound policy (a shared
   * instance refuses internal addresses, redirects included). A refusal or a
   * malformed URL is permanent; a network failure, a timeout, a 5xx or a 429
   * may pass and is retried. The status and the body (JSON when it parses,
   * cut at `HTTP_RESPONSE_BODY_LIMIT`) come back as the step's output.
   */
  private async requestOutward(
    url: string,
    init: { method: string; headers: Record<string, string>; body?: string },
    timeoutMs: number,
    label: string,
  ): Promise<HttpStepOutput> {
    let response: Response;
    try {
      response = await fetchWithPolicy(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }, this.outbound);
    } catch (error) {
      if (error instanceof OutboundRefusedError) throw error;
      const name = error instanceof Error ? error.name : "";
      if (error instanceof TypeError || name === "TimeoutError" || name === "AbortError") {
        throw new RetryableStepError(`${label} request failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }

    // The endpoint is down or asks to slow down: try again.
    if (response.status >= 500 || response.status === 429) {
      await response.body?.cancel().catch(() => {});
      throw new RetryableStepError(`${label} answered ${response.status}`);
    }
    return { status: response.status, ...(await readLimitedBody(response)) };
  }

  /**
   * A Condition step in API mode: POSTs the contact and the trigger event to
   * the user's endpoint; 200 is Yes, any other answer No. The response is
   * kept as the step's output (`{{steps.<id>.body.*}}`).
   */
  private async handleApiCondition(
    execution: WorkflowExecution,
    data: any,
    baseUrl: string,
  ): Promise<{ branch: "yes" | "no"; output: HttpStepOutput }> {
    let { url } = data;
    if (!url) throw new Error("No URL specified for API condition");

    // If URL is relative, prepend baseUrl
    if (url.startsWith("/")) {
      url = `${baseUrl}${url}`;
    }

    const contact = await this.contactRepo.findById(execution.contactId);
    if (!contact) throw new Error("Contact not found");

    this.logger.debug("API Check request", { executionId: execution.id, contactId: contact.id, url });

    const output = await this.requestOutward(
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
      API_CHECK_TIMEOUT_MS,
      "API check",
    );

    const branch = output.status === 200 ? "yes" : "no";
    this.logger.debug("API Check result", {
      executionId: execution.id,
      contactId: contact.id,
      result: branch,
      status: output.status,
    });
    return { branch, output };
  }

  /**
   * An HTTP request step (outwards: no blocks, no `kind`). Header values are
   * opened from their sealed form here, never earlier; the body is the
   * step's JSON with merge tags filled from the contact, the trigger event
   * and step outputs. A 2xx is done; a 4xx fails the step (its `onError`
   * applies); 5xx, 429 and network errors are retried. A redelivered job
   * whose request already answered (the step row has its status) does not
   * send it again.
   */
  private async runHttpStep(ctx: StepContext): Promise<StepOutcome> {
    const { run: execution, node, step } = ctx;
    const data = node.data as HttpStepData;
    const problems = validateHttpStep(data);
    if (problems.length > 0) throw new Error(problems[0]);

    // Dedupe inside the handler: the answer is kept on the step row before the
    // run moves on, so a job that runs again after a crash reuses it.
    const earlier = step.result?.response as HttpStepOutput | undefined;
    if (earlier && typeof earlier.status === "number") return this.httpOutcome(execution.id, node.id, earlier);

    const method = data.method ?? "POST";
    const headers: Record<string, string> = {};
    for (const header of data.headers ?? []) {
      if (typeof header.sealed !== "string") continue;
      const value = await this.workflowRepo.openSecret(header.sealed);
      if (value === null) throw new Error(`HTTP request: the value of header "${header.name}" cannot be decrypted; enter it again`);
      headers[header.name] = value;
    }

    let body: string | undefined;
    if (httpMethodHasBody(method) && data.body && data.body.trim() !== "") {
      const contact = await this.contactRepo.findById(execution.contactId);
      if (!contact) throw new Error("Contact not found");
      body = fillJsonTemplate(data.body, buildStepData(contact, execution.context));
      try {
        JSON.parse(body);
      } catch {
        throw new Error("HTTP request: the body is not valid JSON after merge tags are filled");
      }
      if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
        headers["Content-Type"] = "application/json";
      }
    }

    const timeoutMs = (data.timeoutSeconds ?? HTTP_STEP_DEFAULT_TIMEOUT_S) * 1000;
    const output = await this.requestOutward(data.url!.trim(), { method, headers, body }, timeoutMs, "HTTP request");
    await this.executionRepo.updateStepExecution(step.id, { result: { response: output } });
    return this.httpOutcome(execution.id, node.id, output);
  }

  /** 2xx: done with the response as output. Otherwise the step fails; the response is still kept for later steps. */
  private async httpOutcome(executionId: number, nodeId: string, output: HttpStepOutput): Promise<StepOutcome> {
    if (output.status < 200 || output.status >= 300) {
      await this.executionRepo.setStepOutput(executionId, nodeId, output);
      throw new Error(`HTTP request answered ${output.status}`);
    }
    return {
      kind: "done",
      output,
      result: { status: output.status, ...(output.truncated ? { truncated: true } : {}) },
    };
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

    // A test run does not wait: its delays pass at once.
    const delay = target.type === "delay" && !run.isTest ? await this.delayOf(run, target.data) : 0;
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

    const generation = run.generation ?? 0;
    await this.automationQueue.add(
      `workflow-${executionId}-${target.id}`,
      jobData(executionId, target.id, generation),
      // One job per run, pass and step: adding it again (the sweeper, a retry) is a no-op while it exists.
      { delay, jobId: automationJobId(executionId, target.id, generation) },
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
        lookups.set(
          lookupKey(rule),
          await this.emailEngagement(execution.id, execution.generation ?? 0, rule.nodeId, rule.state),
        );
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
  private async emailEngagement(executionId: number, generation: number, nodeId: string, state: string): Promise<boolean> {
    // Only this pass of the run: an email of a pass before a restart does not count.
    const steps = await this.executionRepo.getStepExecutions(executionId, generation);
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
      const jobId = automationJobId(run.id, run.currentNodeId, run.generation);
      const existing = await this.automationQueue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state !== "failed" && state !== "completed" && state !== "unknown") continue;
        await existing.remove();
      }
      await this.automationQueue.add(
        `workflow-${run.id}-${run.currentNodeId}`,
        jobData(run.id, run.currentNodeId, run.generation),
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

  /** Cancels one run (the "Cancel run" button); its queued job is dropped when it comes. */
  async cancelRun(executionId: number, exitReason: ExecutionExitReason = "cancelled_user"): Promise<boolean> {
    const cancelled = await this.executionRepo.cancel(executionId, exitReason);
    if (cancelled) this.logger.info("Workflow run cancelled", { executionId, reason: exitReason });
    return cancelled;
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
