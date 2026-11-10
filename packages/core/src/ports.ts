import type {
  AiProvider,
  User,
  Project,
  Contact,
  ContactEvent,
  Campaign,
  CampaignEvent,
  EmailProvider,
  TriggeredSendLog,
  LinkStat,
  SavedRow,
  TimeSeriesData,
  Suppression,
  DashboardStats,
  DashboardActivity,
  DashboardEvent,
  ApiKey,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  ExecutionContext,
  WorkflowGraphSnapshot,
  WorkflowVersion,
  ExecutionExitReason,
  WorkflowStepExecution,
} from "./domain";
import type {
  CreateEmailTemplateInput,
  EmailTemplate,
  UpdateEmailTemplateInput,
} from "./emailTemplate";

// ============================================================
// Mailer Interface
// ============================================================

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  /**
   * text/plain alternative. Sending HTML only costs deliverability and leaves
   * text-only readers with nothing.
   */
  text?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  /**
   * Extra RFC 5322 headers, currently List-Unsubscribe and
   * List-Unsubscribe-Post. Not every provider API can carry them - the SES
   * adapter drops them, since SendEmail has no field for custom headers.
   */
  headers?: Record<string, string>;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /**
   * The provider took the request but refused the address for good, and
   * said so in its response (Cloudflare). The send is not retried; the
   * worker records a bounce and suppresses the address, as a bounce webhook
   * would.
   */
  permanentBounce?: boolean;
}

export interface IMailer {
  send(options: SendMailOptions): Promise<SendMailResult>;
}

export interface ISuppressionRepository {
  create(data: Omit<Suppression, "id" | "createdAt">): Promise<Suppression>;
  findByProjectAndEmail(
    projectId: number,
    email: string,
  ): Promise<Suppression | null>;
  findByProject(projectId: number): Promise<Suppression[]>;
  findById(id: number): Promise<Suppression | null>;
  delete(id: number): Promise<void>;
  /**
   * Why `email` must not be mailed in this project, or null. Either a row of
   * the suppression list (bounce, complaint, unsubscribe of an address that
   * is not a contact) or a contact who unsubscribed: unsubscribing a contact
   * only flags the contact, so the list alone missed them. The send worker's
   * one check before every message.
   */
  findSendBlock(projectId: number, email: string): Promise<{ reason: Suppression["reason"] } | null>;
}

export interface IEmailProviderRepository {
  findById(id: number): Promise<EmailProvider | null>;
  findAll(): Promise<EmailProvider[]>;
  /** Rows owned by the user personally (no organization). */
  listForUser(userId: string): Promise<EmailProvider[]>;
  /** Rows owned by the organization. */
  listForOrganization(organizationId: string): Promise<EmailProvider[]>;
  create(
    data: Omit<EmailProvider, "id" | "createdAt" | "updatedAt">,
  ): Promise<EmailProvider>;
  update(
    id: number,
    data: Partial<Omit<EmailProvider, "id" | "createdAt" | "updatedAt">>,
  ): Promise<EmailProvider | null>;
  delete(id: number): Promise<void>;
}

export interface IAiProviderRepository {
  findById(id: number): Promise<AiProvider | null>;
  /** Rows owned by the user personally (no organization). */
  listForUser(userId: string): Promise<AiProvider[]>;
  /** Rows owned by the organization. */
  listForOrganization(organizationId: string): Promise<AiProvider[]>;
  create(
    data: Omit<AiProvider, "id" | "createdAt" | "updatedAt">,
  ): Promise<AiProvider>;
  update(
    id: number,
    data: Partial<Omit<AiProvider, "id" | "createdAt" | "updatedAt">>,
  ): Promise<AiProvider | null>;
  delete(id: number): Promise<void>;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(data: {
    name: string;
    email: string;
    passwordHash: string;
  }): Promise<User>;
}

export interface IProjectRepository {
  create(data: {
    name: string;
    description?: string | null;
    userId?: string | null;
    organizationId?: string | null;
  }): Promise<Project>;

  findById(id: number): Promise<Project | null>;

  findAll(): Promise<Project[]>;

  /** Rows owned by the user personally (no organization). */
  listForUser(userId: string): Promise<Project[]>;
  /** Rows owned by the organization. */
  listForOrganization(organizationId: string): Promise<Project[]>;
  update(
    id: number,
    data: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Project | null>;
  delete(id: number): Promise<void>;
}

export interface IEmailTemplateRepository {
  create(input: CreateEmailTemplateInput): Promise<EmailTemplate>;

  findById(id: number): Promise<EmailTemplate | null>;
  findByProject(projectId: number): Promise<EmailTemplate[]>;
  update(input: UpdateEmailTemplateInput): Promise<EmailTemplate | null>;
  delete(id: number): Promise<void>;
}

export interface ISavedRowRepository {
  findById(id: number): Promise<SavedRow | null>;
  findByUser(userId: string): Promise<SavedRow[]>;
  create(data: {
    userId: string;
    projectId?: number | null;
    name: string;
    data: unknown;
  }): Promise<SavedRow>;
  delete(id: number): Promise<void>;
}

export interface ContactRepository {
  upsert(data: {
    projectId: number;
    email: string;
    name?: string | null;
  }): Promise<Contact>;

  findByProject(projectId: number): Promise<Contact[]>;
  findById(id: number): Promise<Contact | null>;
  findByEmail(projectId: number, email: string): Promise<Contact | null>;
  /** Marks the contact unsubscribed, with the time. */
  unsubscribe(id: number): Promise<void>;
  update(
    id: number,
    data: Partial<Omit<Contact, "id" | "projectId" | "createdAt">>,
  ): Promise<Contact | null>;
}

/**
 * The event log (`contact_events`): every event a contact did, kept for the
 * project's log retention. Automations read it ("did this contact do X").
 */
export interface IContactEventRepository {
  /**
   * Stores the event. When the project already has an event with this
   * idempotency key, stores nothing and returns null: the caller must not
   * dispatch it again.
   */
  record(data: {
    projectId: number;
    contactId: number;
    name: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<ContactEvent | null>;
  /** The event stored with this key in the project, if any. */
  findByIdempotencyKey(projectId: number, idempotencyKey: string): Promise<ContactEvent | null>;
  /** Whether the contact did `name` at or after `since`. */
  existsSince(contactId: number, name: string, since: Date): Promise<boolean>;
  /** Event names the project used, most recently used first (builder suggestions). */
  recentNames(projectId: number, limit: number): Promise<string[]>;
}

export interface IApiKeyRepository {
  /** The key whose stored hash matches (`hashApiKey`). */
  findByHash(keyHash: string): Promise<ApiKey | null>;
  /**
   * A key still stored in the clear, from before hashing. Rows are moved to
   * hashes by `db:hash-api-keys`; until then this keeps them authenticating.
   */
  findLegacyByKey(key: string): Promise<ApiKey | null>;
  findByProject(projectId: number): Promise<ApiKey[]>;
  findById(id: number): Promise<ApiKey | null>;
  create(data: {
    projectId: number;
    name: string;
    keyHash: string;
    prefix: string;
  }): Promise<ApiKey>;
  updateLastUsed(id: number): Promise<void>;
  delete(id: number): Promise<void>;
}

export interface ICampaignRepository {
  create(
    data: Omit<Campaign, "id" | "createdAt" | "updatedAt">,
  ): Promise<Campaign>;
  findById(id: number): Promise<Campaign | null>;
  findByProject(projectId: number): Promise<Campaign[]>;
  /** The trigger that uses the template, if any. */
  findByTemplateId(templateId: number): Promise<Campaign | null>;
  update(
    id: number,
    data: Partial<
      Omit<Campaign, "id" | "projectId" | "createdAt" | "updatedAt">
    >,
  ): Promise<Campaign | null>;
  delete(id: number): Promise<void>;

  logEvent(
    data: Omit<CampaignEvent, "id" | "occurredAt">,
  ): Promise<CampaignEvent>;
  getEventsByCampaign(campaignId: number): Promise<CampaignEvent[]>;
  getPaginatedEventsByCampaign(
    campaignId: number,
    options: {
      page: number;
      pageSize: number;
      type?: string;
      search?: string;
    },
  ): Promise<{ events: CampaignEvent[]; total: number }>;
  getEventStatsByCampaign(campaignId: number): Promise<{
    opens: { unique: number; total: number };
    clicks: { unique: number; total: number };
  }>;
  getLinkStatsByCampaign(campaignId: number): Promise<LinkStat[]>;
  getTimeSeriesStatsByCampaign(
    campaignId: number,
    options: {
      interval: "hour" | "day";
      days?: number;
    },
  ): Promise<TimeSeriesData[]>;
}

export interface ITriggeredSendLogRepository {
  create(
    data: Omit<TriggeredSendLog, "id" | "sentAt">,
  ): Promise<TriggeredSendLog>;
  /**
   * Like `create`, once per `dedupeKey`: a second call with the key returns
   * the first row (`created: false`) and counts nothing.
   */
  createOnce(
    data: Omit<TriggeredSendLog, "id" | "sentAt">,
    dedupeKey: string,
  ): Promise<{ log: TriggeredSendLog; created: boolean }>;
  findByDedupeKey(dedupeKey: string): Promise<TriggeredSendLog | null>;
  findById(id: number): Promise<TriggeredSendLog | null>;
  update(
    id: number,
    data: Partial<Omit<TriggeredSendLog, "id" | "sentAt">>,
  ): Promise<TriggeredSendLog | null>;
  findByProviderMessageId(
    providerMessageId: string,
  ): Promise<TriggeredSendLog | null>;
  findLatestByCampaignAndEmail(
    campaignId: number,
    email: string,
  ): Promise<TriggeredSendLog | null>;
  getStatsByCampaign(campaignId: number): Promise<{
    sent: number;
    delivered: number;
    errors: number;
  }>;
}

/** Dashboard figures over a set of projects the caller was already allowed to see. */
export interface IDashboardRepository {
  getGlobalStats(projectIds: number[]): Promise<DashboardStats>;
  getActivityStats(projectIds: number[], days: number): Promise<DashboardActivity[]>;
  getRecentEvents(projectIds: number[], limit: number): Promise<DashboardEvent[]>;
}

export interface IWorkflowRepository {
  create(
    data: Omit<Workflow, "id" | "createdAt" | "updatedAt">,
  ): Promise<Workflow>;
  findById(id: number): Promise<Workflow | null>;
  findByProject(projectId: number): Promise<Workflow[]>;
  update(
    id: number,
    data: Partial<
      Omit<Workflow, "id" | "projectId" | "createdAt" | "updatedAt">
    >,
  ): Promise<Workflow | null>;
  delete(id: number): Promise<void>;

  // Graph data
  getNodes(workflowId: number): Promise<WorkflowNode[]>;
  getEdges(workflowId: number): Promise<WorkflowEdge[]>;
  saveGraph(
    workflowId: number,
    nodes: Omit<WorkflowNode, "workflowId">[],
    edges: Omit<WorkflowEdge, "workflowId">[],
  ): Promise<void>;

  // Versions
  /**
   * Stores `graph` as the workflow's next version and makes it the active
   * one (`activeVersionId`, `triggerEvent` from its trigger node), in one
   * transaction.
   */
  publishVersion(
    workflowId: number,
    graph: WorkflowGraphSnapshot,
    settings?: Record<string, unknown>,
  ): Promise<WorkflowVersion>;
  getVersion(id: number): Promise<WorkflowVersion | null>;
  /** ACTIVE workflows of the project whose active version's trigger listens for `eventName`. */
  findActiveByTrigger(projectId: number, eventName: string): Promise<Workflow[]>;
}

/** A new run: always RUNNING, at its trigger step. */
export interface NewWorkflowExecution {
  workflowId: number;
  contactId: number;
  versionId: number;
  context: ExecutionContext;
  /** The trigger step. */
  currentNodeId: string;
}

/** The step row to mark COMPLETED in the same transaction as a cursor move or an end. */
export interface CompleteStep {
  id: number;
  result?: Record<string, unknown> | null;
}

/**
 * Runs and their steps. Every change of a run's state is guarded by the
 * state it expects (`RUNNING`, the cursor at `from`): whoever gets `true`
 * back owns the transition, a stale caller gets `false` and does nothing.
 */
export interface IWorkflowExecutionRepository {
  /** Inserts a RUNNING run; null when the contact already has one in this workflow (the unique index decides). */
  create(data: NewWorkflowExecution): Promise<WorkflowExecution | null>;
  findById(id: number): Promise<WorkflowExecution | null>;
  findRunningByContact(
    workflowId: number,
    contactId: number,
  ): Promise<WorkflowExecution | null>;

  /** Moves a RUNNING run's cursor from `from` to `to`, due at `wakeAt`; completes `completeStep` in the same transaction. */
  moveCursor(
    id: number,
    move: { from: string; to: string; wakeAt: Date; completeStep?: CompleteStep },
  ): Promise<boolean>;
  /**
   * Ends a RUNNING run (only while its cursor is at `from`, when given);
   * completes `completeStep` in the same transaction.
   */
  finish(
    id: number,
    end: {
      status: Exclude<WorkflowExecution["status"], "RUNNING">;
      exitReason: ExecutionExitReason;
      from?: string;
      completeStep?: CompleteStep;
    },
  ): Promise<boolean>;

  /**
   * The step's row in the run, created PENDING on first call. A redelivered
   * job gets the existing row back: COMPLETED means the side effect is done.
   */
  claimStep(executionId: number, nodeId: string): Promise<WorkflowStepExecution>;
  updateStepExecution(
    id: number,
    data: Partial<Omit<WorkflowStepExecution, "id" | "startedAt">>,
  ): Promise<void>;
  getStepExecutions(executionId: number): Promise<WorkflowStepExecution[]>;
  getNodeStats(
    workflowId: number,
  ): Promise<import("./domain").WorkflowNodeStats[]>;
}

/**
 * What the daily retention job deletes with. Each delete removes at most
 * `limit` rows and returns how many it removed, so the job works in batches
 * and never holds one long transaction over a large table.
 */
export interface ILogRetentionRepository {
  /** Whether the daily statistics were backfilled (`pnpm db:backfill-stats`); nothing is deleted before. */
  isStatsBackfilled(): Promise<boolean>;
  /** Every project id, the job's work list. */
  listProjectIds(): Promise<number[]>;
  /**
   * Send log rows of the project's campaigns sent before `before`. A PENDING
   * row sent at or after `keepPendingSince` stays: its email may still be
   * on its way through the queue.
   */
  deleteSendLogs(
    projectId: number,
    options: { before: Date; keepPendingSince: Date; limit: number },
  ): Promise<number>;
  /** Raw events of the project's campaigns that occurred before `before`. */
  deleteEvents(projectId: number, options: { before: Date; limit: number }): Promise<number>;
  /** The record of who opened or clicked on a day before `beforeDay` (`YYYY-MM-DD`); only today's matters. */
  deleteDailyUniques(options: { beforeDay: string; limit: number }): Promise<number>;
  /** Events of the project's contacts (`contact_events`) stored before `before`. */
  deleteContactEvents(projectId: number, options: { before: Date; limit: number }): Promise<number>;
}
