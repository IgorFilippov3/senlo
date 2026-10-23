import type {
  AiProvider,
  User,
  Project,
  Contact,
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
}

export interface IWorkflowExecutionRepository {
  create(
    data: Omit<WorkflowExecution, "id" | "startedAt">,
  ): Promise<WorkflowExecution>;
  findById(id: number): Promise<WorkflowExecution | null>;
  findRunningByContact(
    workflowId: number,
    contactId: number,
  ): Promise<WorkflowExecution | null>;
  updateStatus(
    id: number,
    status: WorkflowExecution["status"],
    completedAt?: Date,
  ): Promise<void>;

  // Step tracking
  createStepExecution(
    data: Omit<WorkflowStepExecution, "id" | "startedAt">,
  ): Promise<WorkflowStepExecution>;
  updateStepExecution(
    id: number,
    data: Partial<Omit<WorkflowStepExecution, "id" | "startedAt">>,
  ): Promise<void>;
  getStepExecutions(executionId: number): Promise<WorkflowStepExecution[]>;
  getNodeStats(
    workflowId: number,
  ): Promise<import("./domain").WorkflowNodeStats[]>;
}
