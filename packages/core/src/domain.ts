export interface Project {
  id: number;
  userId?: string | null;
  name: string;
  description?: string | null;
  providerId?: number | null;
  aiProviderId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  id: number;
  projectId: number;
  email: string;
  name?: string | null;
  locale?: string | null;
  meta?: Record<string, unknown> | null;
  unsubscribed: boolean;
  unsubscribedAt?: Date | null;
  createdAt: Date;
}

export interface RecipientList {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  createdAt: Date;
}

export type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type CampaignType = "STANDARD" | "TRIGGERED";

export interface Campaign {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  type: CampaignType;
  status: CampaignStatus;

  // Sender info
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;

  // Email content override
  subject?: string | null;
  preheader?: string | null;

  templateId: number;
  localeTemplates?: Record<string, number> | null;
  listId?: number | null;
  variablesSchema?: Record<string, any> | null;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignEventType =
  | "SENT"
  | "DELIVERED"
  | "OPEN"
  | "CLICK"
  | "BOUNCE"
  | "SPAM_REPORT"
  | "UNSUBSCRIBE"
  | "FAILED";

export interface CampaignEvent {
  id: number;
  campaignId: number;
  contactId?: number | null;
  email: string;
  type: CampaignEventType;
  linkUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: Date;
}

export type WorkflowStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface Workflow {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  status: WorkflowStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowNode {
  id: string;
  workflowId: number;
  type: string;
  data: Record<string, any>;
  positionX: number;
  positionY: number;
}

export interface WorkflowEdge {
  id: string;
  workflowId: number;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
}

export interface WorkflowExecution {
  id: number;
  workflowId: number;
  contactId: number;
  status: "RUNNING" | "COMPLETED" | "CANCELLED" | "FAILED";
  startedAt: Date;
  completedAt?: Date | null;
}

export interface WorkflowStepExecution {
  id: number;
  executionId: number;
  nodeId: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  result?: Record<string, any> | null;
  startedAt: Date;
  completedAt?: Date | null;
}

export interface WorkflowNodeStats {
  nodeId: string;
  total: number;
  active: number;
  completed: number;
  failed: number;
}

export type EmailProviderType = "RESEND" | "MAILGUN" | "SES" | "POSTMARK";

export interface EmailProvider {
  id: number;
  userId?: string | null;
  name: string;
  type: EmailProviderType;
  config: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AiProviderType = "OPENAI" | "ANTHROPIC";

export interface AiProvider {
  id: number;
  userId?: string | null;
  name: string;
  type: AiProviderType;
  config: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: number;
  projectId: number;
  name: string;
  key: string;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

export interface TriggeredSendLog {
  id: number;
  campaignId: number;
  email: string;
  status:
    | "PENDING"
    | "SUCCESS"
    | "FAILED"
    | "BOUNCED"
    | "COMPLAINED"
    | "DELIVERED";
  providerMessageId?: string | null;
  error?: string | null;
  data?: Record<string, any> | null;
  sentAt: Date;
}

export interface SavedRow {
  id: number;
  userId: string;
  projectId?: number | null;
  name: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Suppression {
  id: number;
  projectId: number;
  email: string;
  reason: "SPAM" | "BOUNCE";
  createdAt: Date;
}

export interface LinkStat {
  url: string;
  totalClicks: number;
  uniqueClicks: number;
}

export interface TimeSeriesData {
  timestamp: string;
  opens: number;
  clicks: number;
}

export interface DashboardStats {
  totalSent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  savedSends: number;
}

export interface DashboardActivity {
  timestamp: string;
  success: number;
  suppressed: number;
}

export interface DashboardEvent {
  id: string | number;
  type:
    | "SUPPRESSION_ADDED"
    | "CAMPAIGN_COMPLETED"
    | "CAMPAIGN_STARTED"
    | "BOUNCE"
    | "SPAM"
    | "FAILED";
  title: string;
  description: string;
  occurredAt: Date;
}
