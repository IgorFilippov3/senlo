// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard } from "../access";
import { ServiceHooks } from "../hooks";
import type {
  Workflow,
  WorkflowExecution,
  WorkflowGraphSnapshot,
  WorkflowRunDetail,
  WorkflowRunSummary,
} from "../domain";
import { NotFoundError, NotPublishableError, RecipientNotAllowedError, ValidationError } from "../errors";
import { auditActor, isApiCaller, type Caller } from "../caller";
import type {
  ContactRepository,
  IProjectRepository,
  IWorkflowExecutionRepository,
  IWorkflowRepository,
} from "../ports";
import { parseInput } from "../validation";
import { validateWorkflowGraph } from "../workflow-graph";
import { validateWorkflowSettings } from "../workflow-settings";
import { isValidEventName } from "../workflow-events";
import type { AutomationService } from "./automationService";

/** Runs a page of the runs list shows at most. */
export const RUNS_PAGE_LIMIT = 100;
/** Runs a contact's automation history shows. */
export const CONTACT_RUNS_LIMIT = 50;

export const ListRunsSchema = z.object({
  status: z.enum(["RUNNING", "COMPLETED", "CANCELLED", "FAILED"]).optional(),
  /** Only this contact's runs. */
  email: z.string().trim().email().optional(),
  includeTests: z.boolean().optional(),
  beforeId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(RUNS_PAGE_LIMIT).default(50),
});

const ContactEmailSchema = z.string().trim().min(1, "Email is required").email();

export const TestRunSchema = z.object({
  /** The contact the test run is for; must exist in the workspace. */
  email: z.string().trim().min(1, "Email is required").email(),
  /** The sample trigger event's payload (`{{event.*}}`). */
  payload: z.record(z.unknown()).default({}),
});

export interface AutomationRunsRepositories {
  workflows: IWorkflowRepository;
  executions: IWorkflowExecutionRepository;
  contacts: Pick<ContactRepository, "findById" | "findByEmail" | "upsert">;
  projects: Pick<IProjectRepository, "findById">;
}

/**
 * Runs as people look at them (the run timeline): a workflow's runs, one run
 * with its steps, a contact's automation history, cancelling a run, and test
 * runs of the draft. Every call checks access to the workflow's project.
 */
export class AutomationRunsService {
  private readonly access: AccessGuard;

  constructor(
    private readonly repos: AutomationRunsRepositories,
    private readonly automation: Pick<AutomationService, "cancelRun" | "startTestRun">,
    access?: AccessGuard,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
  ) {
    this.access = access ?? new AccessGuard(repos.projects);
  }

  private async requireWorkflow(caller: Caller, id: number, action: "read" | "write"): Promise<Workflow> {
    return this.access.requireInProject(caller, await this.repos.workflows.findById(id), "Workflow", action);
  }

  /** The run and its workflow, if the caller may access the workflow's project. */
  private async requireRun(
    caller: Caller,
    runId: number,
    action: "read" | "write",
  ): Promise<{ run: WorkflowExecution; workflow: Workflow }> {
    const run = await this.repos.executions.findById(runId);
    if (!run) throw new NotFoundError("Run");
    const workflow = await this.requireWorkflow(caller, run.workflowId, action);
    return { run, workflow };
  }

  /** The workflow's runs, newest first; `nextBeforeId` asks for the next page. */
  async listRuns(
    userId: string,
    workflowId: number,
    rawFilter: unknown,
  ): Promise<{ runs: WorkflowRunSummary[]; nextBeforeId: number | null }> {
    const workflow = await this.requireWorkflow(userId, workflowId, "read");
    const filter = parseInput(ListRunsSchema, rawFilter ?? {});
    let contactId: number | undefined;
    if (filter.email) {
      const contact = await this.repos.contacts.findByEmail(workflow.projectId, filter.email);
      if (!contact) return { runs: [], nextBeforeId: null };
      contactId = contact.id;
    }
    const runs = await this.repos.executions.listRuns(workflowId, {
      status: filter.status,
      contactId,
      includeTests: filter.includeTests,
      beforeId: filter.beforeId,
      limit: filter.limit,
    });
    return { runs, nextBeforeId: runs.length === filter.limit ? runs[runs.length - 1].id : null };
  }

  /** One run with the steps of its current pass, its context and the graph it runs on. */
  async getRun(caller: Caller, runId: number): Promise<WorkflowRunDetail> {
    const { run, workflow } = await this.requireRun(caller, runId, "read");
    const generation = run.generation ?? 0;
    const [steps, version, contact] = await Promise.all([
      this.repos.executions.getStepExecutions(run.id, generation),
      run.versionId ? this.repos.workflows.getVersion(run.versionId) : Promise.resolve(null),
      this.repos.contacts.findById(run.contactId),
    ]);
    return {
      run: {
        id: run.id,
        workflowId: run.workflowId,
        workflowName: workflow.name,
        contactId: run.contactId,
        contactEmail: contact?.email ?? null,
        status: run.status,
        exitReason: run.exitReason ?? null,
        currentNodeId: run.currentNodeId,
        isTest: run.isTest ?? false,
        versionId: run.versionId,
        startedAt: run.startedAt,
        completedAt: run.completedAt ?? null,
        context: run.context,
        wakeAt: run.wakeAt ?? null,
        waitingEvent: run.waitingEvent ?? null,
        generation,
      },
      steps,
      graph: version?.graph ?? null,
    };
  }

  /**
   * The contact a test run is for. In the UI it must exist. Through the API
   * (a coding agent) the address must belong to a member of the
   * organization, and a missing contact is created, counted like any new
   * contact; no `contact_added` is fired, so no automation starts for it.
   */
  private async testContact(caller: Caller, projectId: number, rawEmail: string) {
    if (!isApiCaller(caller)) {
      const contact = await this.repos.contacts.findByEmail(projectId, rawEmail);
      if (!contact) throw new NotFoundError("Contact");
      return contact;
    }
    const email = rawEmail.trim();
    const project = await this.access.requireProject(caller, projectId, "write");
    const allowed = await this.access.testRecipients(project);
    if (!allowed.includes(email.toLowerCase())) throw new RecipientNotAllowedError(allowed);

    const existing = await this.repos.contacts.findByEmail(projectId, email);
    if (existing) return existing;
    await this.hooks.requireQuota({ type: "contact.create", projectId });
    const contact = await this.repos.contacts.upsert({ projectId, email });
    await this.hooks.recordUsage({ type: "contact.created", projectId, contactId: contact.id });
    return contact;
  }

  /** Cancels a run in progress; `cancelled: false` when it had already ended. */
  async cancelRun(userId: string, runId: number): Promise<{ cancelled: boolean }> {
    const { run, workflow } = await this.requireRun(userId, runId, "write");
    const cancelled = await this.automation.cancelRun(run.id, "cancelled_user");
    if (cancelled) {
      await this.hooks.audit({
        actor: { userId },
        action: "workflow.run_cancelled",
        target: { type: "workflow", id: workflow.id, projectId: workflow.projectId },
        details: { runId: run.id, contactId: run.contactId },
      });
    }
    return { cancelled };
  }

  /**
   * A contact's runs in every workflow of the project, newest first (the
   * contact's automation history), found by email; empty when there is no
   * such contact.
   */
  async contactRuns(userId: string, projectId: number, rawEmail: unknown): Promise<WorkflowRunSummary[]> {
    await this.access.requireProject(userId, projectId, "read");
    const email = parseInput(ContactEmailSchema, rawEmail);
    const contact = await this.repos.contacts.findByEmail(projectId, email);
    if (!contact) return [];
    return this.repos.executions.listContactRuns(contact.id, CONTACT_RUNS_LIMIT);
  }

  /**
   * Starts a test run of the saved draft for a contact of the workspace,
   * with a sample trigger event (the trigger's event name and `payload`).
   * The draft must be complete, as for going live; the workflow need not be
   * live. See `AutomationService.startTestRun` for what a test run skips.
   */
  async startTestRun(caller: Caller, workflowId: number, rawInput: unknown): Promise<{ runId: number }> {
    const workflow = await this.requireWorkflow(caller, workflowId, "write");
    const input = parseInput(TestRunSchema, rawInput);

    const graph = await this.draftGraph(workflowId);
    const check = validateWorkflowGraph(
      graph.nodes,
      graph.edges.map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, sourceHandle: e.sourceHandle })),
    );
    const reasons = [...(check.valid ? [] : check.reasons), ...validateWorkflowSettings(workflow.settings)];
    if (reasons.length > 0) throw new NotPublishableError("This draft cannot run yet.", reasons);

    const eventName = graph.nodes.find((n) => n.type === "trigger")?.data?.event;
    if (typeof eventName !== "string" || !isValidEventName(eventName)) {
      throw new ValidationError("Choose the event that starts the automation.");
    }

    const contact = await this.testContact(caller, workflow.projectId, input.email);

    const version = await this.repos.workflows.createTestVersion(workflowId, graph, workflow.settings ?? {});
    const run = await this.automation.startTestRun({
      workflowId,
      contactId: contact.id,
      version,
      event: { name: eventName, payload: input.payload },
    });
    await this.hooks.audit({
      actor: auditActor(caller),
      action: "workflow.test_run_started",
      target: { type: "workflow", id: workflow.id, projectId: workflow.projectId },
      details: { runId: run.id, contactId: contact.id },
    });
    return { runId: run.id };
  }

  private async draftGraph(id: number): Promise<WorkflowGraphSnapshot> {
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
}
