import type {
  ActionResult,
  ApiKey,
  Campaign,
  CampaignEvent,
  DashboardActivity,
  DashboardEvent,
  DashboardStats,
  EmailTemplate,
  FormActionResult,
  IssuedApiKey,
  LinkStat,
  Project,
  PublicAiProvider,
  PublicEmailProvider,
  Suppression,
  TimeSeriesData,
  ProjectAutomationSettings,
  Workflow,
  WorkflowNodeStats,
  WorkflowRunDetail,
  WorkflowRunStats,
  WorkflowRunSummary,
  WorkflowExport,
  WorkflowSettings,
} from "@senlo/core";
import type { CreateWorkspaceValues } from "../workspaces/CreateWorkspaceDialog";
import type { WorkspaceFormValues } from "../workspaces/WorkspaceFields";
import type { CreateTemplateValues } from "../templates/CreateTemplateDialog";
import type { EmailProviderValues } from "../providers/EmailProviderDialog";
import type { AiProviderValues } from "../providers/AiProviderDialog";

/** Filters of the runs list. */
export interface RunsFilter {
  status?: WorkflowRunSummary["status"];
  email?: string;
  includeTests?: boolean;
  beforeId?: number;
  limit?: number;
}

/** Raw form values; the server validates them. */
export type FormValues = Record<string, unknown>;

/**
 * Every call the client data layer makes. Self-hosted implements it with its
 * Server Actions, another shell with whatever reaches its server. Each call
 * resolves to a result, never throws for a refusal: the hooks turn failures
 * into rejected queries and mutations.
 */
export interface SenloActions {
  workspaces: {
    list(): Promise<ActionResult<Project[]>>;
    create(values: CreateWorkspaceValues): Promise<FormActionResult<Project>>;
    update(projectId: number, values: WorkspaceFormValues): Promise<FormActionResult<Project>>;
    delete(projectId: number): Promise<ActionResult<void>>;
    /** Days each email's details are kept; `null` is forever. */
    logRetention(projectId: number): Promise<ActionResult<{ days: number | null }>>;
    /** The workspace's automation limits (frequency cap). */
    automationSettings(projectId: number): Promise<ActionResult<ProjectAutomationSettings>>;
    /** Sets the frequency cap, or removes it with `frequencyCap: null`. */
    updateAutomationSettings(
      projectId: number,
      settings: { frequencyCap: { emails: number; days: number } | null },
    ): Promise<ActionResult<ProjectAutomationSettings>>;
  };
  templates: {
    list(projectId: number): Promise<ActionResult<EmailTemplate[]>>;
    create(projectId: number, values: CreateTemplateValues): Promise<ActionResult<EmailTemplate>>;
    delete(projectId: number, templateId: number): Promise<ActionResult<void>>;
  };
  campaigns: {
    listForProject(projectId: number): Promise<ActionResult<Campaign[]>>;
    events(
      campaignId: number,
      params: { page: number; pageSize: number; type?: string; search?: string },
    ): Promise<ActionResult<{ events: CampaignEvent[]; total: number }>>;
    linkStats(campaignId: number): Promise<ActionResult<LinkStat[]>>;
    timeSeries(
      campaignId: number,
      options: { interval: "hour" | "day"; days?: number },
    ): Promise<ActionResult<TimeSeriesData[]>>;
    createTriggered(values: FormValues): Promise<FormActionResult<Campaign>>;
    updateTriggered(campaignId: number, values: FormValues): Promise<FormActionResult<Campaign>>;
    delete(campaignId: number): Promise<ActionResult<void>>;
  };
  emailProviders: {
    list(): Promise<ActionResult<PublicEmailProvider[]>>;
    create(values: EmailProviderValues): Promise<FormActionResult<PublicEmailProvider>>;
    update(providerId: number, values: EmailProviderValues): Promise<FormActionResult<PublicEmailProvider>>;
    toggle(providerId: number, isActive: boolean): Promise<ActionResult<PublicEmailProvider>>;
    delete(providerId: number): Promise<ActionResult<void>>;
  };
  aiProviders: {
    list(): Promise<ActionResult<PublicAiProvider[]>>;
    create(values: AiProviderValues): Promise<FormActionResult<PublicAiProvider>>;
    toggle(providerId: number, isActive: boolean): Promise<ActionResult<PublicAiProvider>>;
    delete(providerId: number): Promise<ActionResult<void>>;
  };
  apiKeys: {
    list(projectId: number): Promise<ActionResult<ApiKey[]>>;
    /** Returns the plain key once; the list carries only the prefix. */
    create(projectId: number, name: string): Promise<ActionResult<IssuedApiKey>>;
    delete(apiKeyId: number): Promise<ActionResult<void>>;
  };
  suppressions: {
    listForProject(projectId: number): Promise<ActionResult<Suppression[]>>;
    delete(suppressionId: number): Promise<ActionResult<void>>;
  };
  dashboard: {
    get(
      projectId: number,
      options: { days: number; eventLimit: number },
    ): Promise<
      ActionResult<{ stats: DashboardStats; activity: DashboardActivity[]; events: DashboardEvent[] }>
    >;
  };
  workflows: {
    list(projectId: number): Promise<ActionResult<Workflow[]>>;
    create(projectId: number, name: string): Promise<ActionResult<Workflow>>;
    saveGraph(
      workflowId: number,
      graph: { nodes: unknown[]; edges: unknown[] },
    ): Promise<ActionResult<void>>;
    setStatus(workflowId: number, status: Workflow["status"]): Promise<ActionResult<void>>;
    delete(workflowId: number): Promise<ActionResult<void>>;
    stats(workflowId: number): Promise<ActionResult<WorkflowNodeStats[]>>;
    /** Event names the project has sent, most recent first (trigger suggestions). */
    eventNames(projectId: number): Promise<ActionResult<string[]>>;
    /** Goal, entry rules, kind; a live workflow publishes a new version. */
    updateSettings(workflowId: number, settings: WorkflowSettings): Promise<ActionResult<WorkflowSettings>>;
    /** Runs by outcome; conversion = goal / started. */
    runStats(workflowId: number): Promise<ActionResult<WorkflowRunStats>>;
    /** Contact attributes and the payload keys of `eventName`'s recent events (rule builder suggestions). */
    fieldSuggestions(
      projectId: number,
      eventName: string | null,
    ): Promise<ActionResult<{ contact: string[]; event: string[] }>>;
    /** The workflow's runs, newest first; pass `nextBeforeId` back as `beforeId` for the next page. */
    runs(workflowId: number, filter: RunsFilter): Promise<ActionResult<{ runs: WorkflowRunSummary[]; nextBeforeId: number | null }>>;
    /** One run with its steps, context and graph (the run timeline). */
    run(runId: number): Promise<ActionResult<WorkflowRunDetail>>;
    /** Cancels a run in progress. */
    cancelRun(runId: number): Promise<ActionResult<{ cancelled: boolean }>>;
    /** Starts a test run of the saved draft for a contact, with a sample event payload. */
    testRun(workflowId: number, input: { email: string; payload: Record<string, unknown> }): Promise<ActionResult<{ runId: number }>>;
    /** The automation as an export file (its saved draft and settings). */
    export(workflowId: number): Promise<ActionResult<WorkflowExport>>;
    /** A new draft from an export; `emails` maps each email's trigger name to a trigger here (null: leave it empty). */
    import(
      projectId: number,
      input: { workflow: unknown; name?: string; emails: Record<string, number | null> },
    ): Promise<ActionResult<Workflow>>;
    /** A contact's runs in every workflow of the project, by email (automation history). */
    contactRuns(projectId: number, email: string): Promise<ActionResult<WorkflowRunSummary[]>>;
  };
}
