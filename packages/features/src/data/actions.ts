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
  LinkStat,
  Project,
  PublicAiProvider,
  PublicEmailProvider,
  Suppression,
  TimeSeriesData,
  Workflow,
  WorkflowNodeStats,
} from "@senlo/core";
import type { CreateWorkspaceValues } from "../workspaces/CreateWorkspaceDialog";
import type { WorkspaceFormValues } from "../workspaces/WorkspaceFields";

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
    get(projectId: number): Promise<ActionResult<Project>>;
    create(values: CreateWorkspaceValues): Promise<FormActionResult<Project>>;
    update(projectId: number, values: WorkspaceFormValues): Promise<FormActionResult<Project>>;
    delete(projectId: number): Promise<ActionResult<void>>;
  };
  templates: {
    list(projectId: number): Promise<ActionResult<EmailTemplate[]>>;
    create(projectId: number, values: FormValues): Promise<ActionResult<EmailTemplate>>;
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
    create(values: FormValues): Promise<FormActionResult<PublicEmailProvider>>;
    update(providerId: number, values: FormValues): Promise<FormActionResult<PublicEmailProvider>>;
    toggle(providerId: number, isActive: boolean): Promise<ActionResult<PublicEmailProvider>>;
    delete(providerId: number): Promise<ActionResult<void>>;
  };
  aiProviders: {
    list(): Promise<ActionResult<PublicAiProvider[]>>;
    create(values: FormValues): Promise<FormActionResult<PublicAiProvider>>;
    toggle(providerId: number, isActive: boolean): Promise<ActionResult<PublicAiProvider>>;
    delete(providerId: number): Promise<ActionResult<void>>;
  };
  apiKeys: {
    list(projectId: number): Promise<ActionResult<ApiKey[]>>;
    create(projectId: number, name: string): Promise<ActionResult<ApiKey>>;
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
  };
}
