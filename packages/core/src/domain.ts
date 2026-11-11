import type { ConditionGroup } from "./workflow-conditions";
/** An account. `passwordHash` is set for credentials sign-in only. */
export interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  passwordHash: string | null;
}

export interface Project {
  id: number;
  /** The creator; the owner while `organizationId` is null. */
  userId?: string | null;
  /** Owning organization in a managed install; always null in self-hosted. */
  organizationId?: string | null;
  name: string;
  description?: string | null;
  providerId?: number | null;
  aiProviderId?: number | null;
  /** Automation limits of the project (frequency cap). */
  automationSettings?: ProjectAutomationSettings;
  createdAt: Date;
  updatedAt: Date;
}

/** A project's automation limits (`projects.automation_settings`). */
export interface ProjectAutomationSettings {
  /**
   * At most `emails` automation emails per contact in `days` days. An email
   * step over the cap is skipped (`frequency_cap`) and the run goes on.
   */
  frequencyCap?: { emails: number; days: number };
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

/** An event name: one of `SYSTEM_EVENT_TYPES` or a custom name matching `EVENT_NAME_PATTERN`. */
export type WorkflowEventType = string;

/** One stored event of a contact (`contact_events`), kept for the project's log retention. */
export interface ContactEvent {
  id: number;
  projectId: number;
  contactId: number;
  name: string;
  payload: Record<string, unknown>;
  idempotencyKey: string | null;
  createdAt: Date;
}

export interface Workflow {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  status: WorkflowStatus;
  /** The version new runs start on; set when the workflow goes live or a live graph is saved. */
  activeVersionId?: number | null;
  /** The active version's trigger event name, for the trigger lookup. */
  triggerEvent?: string | null;
  /** The draft's settings (goal, entry rules, kind); published with the graph. */
  settings?: WorkflowSettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * How a workflow treats contacts, besides its graph. Copied into each
 * version, so a run follows the settings it started with.
 */
export interface WorkflowSettings {
  /**
   * `transactional` (default): mail the contact asked for; an unsubscribed
   * or suppressed contact's email step is skipped and the run goes on.
   * `lifecycle`: marketing mail (win-back, nurture, upsell); such a contact
   * ends the run, and unsubscribing ends their runs at once.
   */
  kind?: "transactional" | "lifecycle";
  /** When the contact does `event` (and `filters` hold), every run of theirs in this workflow ends: the goal is reached. */
  goal?: { event: string; filters?: ConditionGroup };
  /**
   * Who may enter. `after_exit` (default): again once the previous run ended;
   * `once`: never twice; `restart`: a new trigger event of a contact whose
   * run is in progress moves that run back to its start, with the new event
   * (the same run, not a new one). `cooldown`: not within this time after the last start.
   */
  entry?: {
    mode: "once" | "after_exit" | "restart";
    cooldown?: { duration: number; unit: "minutes" | "hours" | "days" };
  };
}

/** A workflow's graph as the builder saved it, without the workflow id. */
export interface WorkflowGraphSnapshot {
  nodes: Omit<WorkflowNode, "workflowId">[];
  edges: Omit<WorkflowEdge, "workflowId">[];
}

/**
 * One published graph of a workflow. Immutable: a run executes the version
 * it started on, so editing a live workflow never changes a run in flight.
 */
export interface WorkflowVersion {
  id: number;
  workflowId: number;
  /** 1, 2, 3 per workflow; a test version (a draft run from the builder) is numbered -1, -2, … */
  version: number;
  graph: WorkflowGraphSnapshot;
  settings: WorkflowSettings;
  /** A snapshot of the draft for a test run; never active. */
  isTest?: boolean;
  createdAt: Date;
}

/** Why a run ended (`workflow_executions.exit_reason`). */
export type ExecutionExitReason =
  | "completed"
  | "exit_node"
  | "error"
  | "invalid_run"
  | "upgrade"
  | "cancelled_api"
  | "goal"
  | "unsubscribed"
  | "suppressed"
  | "cancelled_user"
  | (string & {});

export interface WorkflowNode {
  id: string;
  workflowId: number;
  type: string;
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  workflowId: number;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
}

/**
 * What a run carries with it: the event that started it and the output of
 * its steps. Copied into the run, so the event log can be deleted by
 * retention without touching runs in flight.
 */
export interface ExecutionContext {
  /** The trigger event; absent for a run started without one. */
  event?: { name: string; payload: Record<string, unknown> };
  /** nodeId -> output (HTTP body, payload of a waited event). */
  steps: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: number;
  workflowId: number;
  contactId: number;
  status: "RUNNING" | "COMPLETED" | "CANCELLED" | "FAILED";
  /** The version the run executes; null only for a row from before versions (cancelled by `db:upgrade-automations`). */
  versionId: number | null;
  context: ExecutionContext;
  /** The cursor: the step the run is at. Null only on rows from before cursors. */
  currentNodeId: string | null;
  /** When the cursor step is due (for a run waiting for an event: its timeout). */
  wakeAt?: Date | null;
  /** The event a Wait for event step waits for; set only while it waits. */
  waitingEvent?: string | null;
  /** The goal event, copied from the version's settings at start. */
  goalEvent?: string | null;
  exitReason?: ExecutionExitReason | null;
  /** A test run (started from the builder): not counted, not in stats, delays skipped. */
  isTest?: boolean;
  /** How many times a `restart` entry moved the run back to its start; step rows are per generation. */
  generation?: number;
  startedAt: Date;
  completedAt?: Date | null;
}

/** A run as the runs list and a contact's history show it. */
export interface WorkflowRunSummary {
  id: number;
  workflowId: number;
  workflowName?: string;
  contactId: number;
  contactEmail: string | null;
  status: WorkflowExecution["status"];
  exitReason?: ExecutionExitReason | null;
  currentNodeId: string | null;
  isTest: boolean;
  versionId: number | null;
  startedAt: Date;
  completedAt?: Date | null;
}

/** One run with its steps (of its current generation) and context, for the run timeline. */
export interface WorkflowRunDetail {
  run: WorkflowRunSummary & {
    context: ExecutionContext;
    wakeAt?: Date | null;
    waitingEvent?: string | null;
    generation: number;
  };
  steps: WorkflowStepExecution[];
  /** The graph of the version the run executes, to name and order its steps. */
  graph: WorkflowGraphSnapshot | null;
}

export interface WorkflowStepExecution {
  id: number;
  executionId: number;
  nodeId: string;
  /** The run's generation the row belongs to (see `WorkflowExecution.generation`). */
  generation?: number;
  /** SKIPPED: the step failed and its `onError` was "continue" (or, later, it did not apply). */
  status: "PENDING" | "COMPLETED" | "FAILED" | "SKIPPED";
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
  /** The step did not apply (a blocked contact's email) or failed with `onError: continue`. */
  skipped: number;
}

/** A workflow's runs by outcome. Conversion = `goal / started`. */
export interface WorkflowRunStats {
  started: number;
  running: number;
  /** Ended at the end of a branch or an Exit step (not by the goal). */
  completed: number;
  /** Ended by the goal event. */
  goal: number;
  failed: number;
  cancelled: number;
}

export type EmailProviderType =
  | "RESEND"
  | "MAILGUN"
  | "SES"
  | "POSTMARK"
  | "SENDGRID"
  | "MAILJET"
  | "CLOUDFLARE"
  | "SMTP";

export interface EmailProvider {
  id: number;
  userId?: string | null;
  /** See `Project.organizationId`. */
  organizationId?: string | null;
  name: string;
  type: EmailProviderType;
  config: Record<string, any>;
  /**
   * The stored config could not be decrypted (sealed with another
   * `SECRETS_KEY`); `config` is empty. Listed so the credentials can be
   * re-entered; refused for sending.
   */
  configUnreadable?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type AiProviderType = "OPENAI" | "ANTHROPIC";

/**
 * A provider as a browser may see it: the config without its credentials,
 * plus the names of the credential fields that hold a value.
 */
export interface PublicEmailProvider extends Omit<EmailProvider, "config"> {
  config: Record<string, string | number>;
  secretsSet: string[];
}

export interface AiProvider {
  id: number;
  userId?: string | null;
  /** See `Project.organizationId`. */
  organizationId?: string | null;
  name: string;
  type: AiProviderType;
  config: Record<string, any>;
  /**
   * The stored config could not be decrypted (sealed with another
   * `SECRETS_KEY`); `config` is empty. Listed so the credentials can be
   * re-entered; refused for sending.
   */
  configUnreadable?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** The model used when an AI provider form leaves it empty. */
export const DEFAULT_AI_MODELS: Record<AiProviderType, string> = {
  OPENAI: "gpt-4o",
  ANTHROPIC: "claude-3-5-sonnet-20240620",
};

/** An AI provider as a browser may see it: the model, never the key. */
export interface PublicAiProvider extends Omit<AiProvider, "config"> {
  config: { model?: string };
  secretsSet: string[];
}

/** An API key as listed: the key itself is stored hashed and never returned again. */
export interface ApiKey {
  id: number;
  projectId: number;
  name: string;
  /** The first characters of the key, to tell keys apart in a list. */
  prefix: string;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

/** A freshly created key: the only time the plain `key` leaves the server. */
export interface IssuedApiKey extends ApiKey {
  key: string;
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
  /** The automation run that sent it; null for API and campaign sends. */
  workflowExecutionId?: number | null;
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
  reason: "SPAM" | "BOUNCE" | "UNSUBSCRIBE";
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

/** A trigger's delivery and engagement totals, as its detail page shows them. */
export interface CampaignStats {
  sent: number;
  delivered: number;
  errors: number;
  opens: { unique: number; total: number };
  clicks: { unique: number; total: number };
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
