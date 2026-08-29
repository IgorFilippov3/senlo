import type {
  Project,
  Contact,
  RecipientList,
  Campaign,
  CampaignEvent,
  EmailProvider,
  TriggeredSendLog,
  LinkStat,
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
import type { EmailTemplate } from "./emailTemplate";

// ============================================================
// Mailer Interface
// ============================================================

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  tags?: Record<string, string>;
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
  findAllByUser(
    userId: string,
  ): Promise<(Suppression & { projectName: string })[]>;
  findById(id: number): Promise<Suppression | null>;
  delete(id: number): Promise<void>;
}

export interface IEmailProviderRepository {
  findById(id: number): Promise<EmailProvider | null>;
  findAll(): Promise<EmailProvider[]>;
}

export interface IProjectRepository {
  create(data: {
    name: string;
    description?: string | null;
    userId?: string | null;
  }): Promise<Project>;

  findById(id: number): Promise<Project | null>;

  findAll(): Promise<Project[]>;

  findByUser(userId: string): Promise<Project[]>;
  update(
    id: number,
    data: Partial<Omit<Project, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Project | null>;
  delete(id: number): Promise<void>;
}

export interface IEmailTemplateRepository {
  create(data: {
    projectId: number;
    name: string;
    subject: string;
    html: string;
    designJson?: unknown;
  }): Promise<EmailTemplate>;

  findById(id: number): Promise<EmailTemplate | null>;
  findByProject(projectId: number): Promise<EmailTemplate[]>;
}

export interface ContactRepository {
  upsert(data: {
    projectId: number;
    email: string;
    name?: string | null;
  }): Promise<Contact>;

  findByProject(projectId: number): Promise<Contact[]>;
  findById(id: number): Promise<Contact | null>;
  update(
    id: number,
    data: Partial<Omit<Contact, "id" | "projectId" | "createdAt">>,
  ): Promise<Contact | null>;
}

export interface RecipientListRepository {
  create(data: {
    projectId: number;
    name: string;
    description?: string | null;
  }): Promise<RecipientList>;

  addContacts(listId: number, contactIds: number[]): Promise<void>;

  findByProject(projectId: number): Promise<RecipientList[]>;
  getContacts(listId: number, onlyActive?: boolean): Promise<Contact[]>;
}

export interface IApiKeyRepository {
  findByKey(key: string): Promise<ApiKey | null>;
  findByProject(projectId: number): Promise<ApiKey[]>;
  findById(id: number): Promise<ApiKey | null>;
  create(data: {
    projectId: number;
    name: string;
    key: string;
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

export interface IDashboardRepository {
  getGlobalStats(userId: string, projectId?: number): Promise<DashboardStats>;
  getActivityStats(
    userId: string,
    days: number,
    projectId?: number,
  ): Promise<DashboardActivity[]>;
  getRecentEvents(
    userId: string,
    limit: number,
    projectId?: number,
  ): Promise<DashboardEvent[]>;
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
