// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Caller } from "../caller";
import { z } from "zod";
import { AccessGuard, listInScope, type AccessAction } from "../access";
import type {
  Campaign,
  CampaignStats,
  CampaignEvent,
  LinkStat,
  Project,
  TimeSeriesData,
} from "../domain";
import type { EmailTemplate } from "../emailTemplate";
import { NotFoundError, ValidationError } from "../errors";
import type {
  ICampaignRepository,
  IEmailTemplateRepository,
  IProjectRepository,
  ITriggeredSendLogRepository,
} from "../ports";
import { boundedInt, parseInput } from "../validation";
import { parseApiInput } from "../api-issues";
import { pageOf, type Page, type PageRequest } from "../api-v1/pagination";
import { ApiCreateTriggerSchema, ApiUpdateTriggerSchema } from "../api-v1/schemas";
import { jsonObjectError } from "../json-object";

const optionalId = z.preprocess(
  (val) => (val === "" ? undefined : val),
  z.coerce.number().int().positive(),
);

/** A sender address from a form field; an empty field means "no sender of its own". */
const optionalEmail = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  z.string().trim().email().nullable().optional(),
);

/**
 * A JSON object from a form field. A blank field means none; anything that
 * is not a JSON object is a field error rather than silently dropped.
 */
const jsonField = z
  .string()
  .optional()
  .transform((val, ctx): Record<string, unknown> | null => {
    if (!val || val.trim() === "") return null;
    const error = jsonObjectError(val);
    if (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
      return z.NEVER;
    }
    return JSON.parse(val) as Record<string, unknown>;
  });

export const CreateTriggeredCampaignSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().optional(),
  projectId: optionalId,
  templateId: optionalId,
  type: z.literal("TRIGGERED").default("TRIGGERED"),
  fromName: z.string().max(255).trim().optional(),
  fromEmail: optionalEmail,
  variablesSchema: jsonField,
});

export const UpdateTriggeredCampaignSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().optional(),
  fromName: z.string().max(255).trim().optional(),
  fromEmail: optionalEmail,
  variablesSchema: jsonField,
  localeTemplates: jsonField,
});

export type CreateTriggeredCampaignInput = z.infer<typeof CreateTriggeredCampaignSchema>;
export type UpdateTriggeredCampaignInput = z.infer<typeof UpdateTriggeredCampaignSchema>;

export interface CampaignDetails {
  campaign: Campaign;
  project: Project;
  template: EmailTemplate;
  stats: CampaignStats;
}

export interface CampaignServiceRepositories {
  campaigns: ICampaignRepository;
  projects: IProjectRepository;
  templates: IEmailTemplateRepository;
  sendLogs: ITriggeredSendLogRepository;
}

/**
 * Campaigns and triggers as the UI works with them: everything checks that
 * the campaign's project is the caller's, and template ids named by a form
 * must live in that project. Sending is `TriggerService`'s.
 */
export class CampaignService {
  private readonly access: AccessGuard;

  constructor(
    private readonly repos: CampaignServiceRepositories,
    access?: AccessGuard,
  ) {
    this.access = access ?? new AccessGuard(repos.projects);
  }

  /** The campaign and its project, if the caller may do `action` on them. */
  async requireCampaign(
    caller: Caller,
    campaignId: number,
    action: AccessAction,
  ): Promise<{ campaign: Campaign; project: Project }> {
    const campaign = await this.access.requireInProject(
      caller,
      await this.repos.campaigns.findById(campaignId),
      "Trigger",
      action,
    );
    const project = await this.access.requireProject(caller, campaign.projectId, action);
    return { campaign, project };
  }

  /** Null when the campaign's template is gone. */
  async getDetails(userId: string, campaignId: number): Promise<CampaignDetails | null> {
    const { campaign, project } = await this.requireCampaign(userId, campaignId, "read");
    const [template, eventStats, sendStats] = await Promise.all([
      this.repos.templates.findById(campaign.templateId),
      this.repos.campaigns.getEventStatsByCampaign(campaignId),
      this.repos.sendLogs.getStatsByCampaign(campaignId),
    ]);
    if (!template) return null;
    return {
      campaign,
      project,
      template,
      stats: { ...sendStats, opens: eventStats.opens, clicks: eventStats.clicks },
    };
  }

  async getEvents(
    userId: string,
    campaignId: number,
    options: { page: number; pageSize: number; type?: string; search?: string },
  ): Promise<{ events: CampaignEvent[]; total: number }> {
    await this.requireCampaign(userId, campaignId, "read");
    return this.repos.campaigns.getPaginatedEventsByCampaign(campaignId, options);
  }

  async getLinkStats(userId: string, campaignId: number): Promise<LinkStat[]> {
    await this.requireCampaign(userId, campaignId, "read");
    return this.repos.campaigns.getLinkStatsByCampaign(campaignId);
  }

  async getTimeSeriesStats(
    userId: string,
    campaignId: number,
    options: { interval: "hour" | "day"; days?: number },
  ): Promise<TimeSeriesData[]> {
    // Server action input: checked here, whatever the type says.
    const interval: unknown = options?.interval;
    if (interval !== "hour" && interval !== "day") {
      throw new ValidationError('interval must be "hour" or "day"');
    }
    const days = boundedInt(options.days, { field: "days", min: 1, max: 365, fallback: 7 });
    await this.requireCampaign(userId, campaignId, "read");
    return this.repos.campaigns.getTimeSeriesStatsByCampaign(campaignId, { interval, days });
  }

  /** Every campaign across the user's projects. */
  async listForUser(userId: string): Promise<Campaign[]> {
    const projects = await listInScope(await this.access.scopeFor(userId), this.repos.projects);
    const perProject = await Promise.all(
      projects.map((p) => this.repos.campaigns.findByProject(p.id)),
    );
    return perProject.flat();
  }

  async listForProject(caller: Caller, projectId: number): Promise<Campaign[]> {
    await this.access.requireProject(caller, projectId, "read");
    return this.repos.campaigns.findByProject(projectId);
  }

  /** Raw form fields in. */
  async createTriggered(caller: Caller, rawInput: unknown): Promise<Campaign> {
    const input = parseInput(CreateTriggeredCampaignSchema, rawInput);
    await this.access.requireProject(caller, input.projectId, "write");
    await this.requireProjectTemplates(input.projectId, [input.templateId]);

    return this.repos.campaigns.create({
      name: input.name,
      description: input.description,
      projectId: input.projectId,
      templateId: input.templateId,
      listId: null,
      type: "TRIGGERED",
      variablesSchema: input.variablesSchema,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      status: "DRAFT",
    });
  }

  async updateTriggered(caller: Caller, campaignId: number, rawInput: unknown): Promise<Campaign> {
    const { project } = await this.requireCampaign(caller, campaignId, "write");
    const input = parseInput(UpdateTriggeredCampaignSchema, rawInput);

    const localeTemplates = input.localeTemplates as Record<string, number> | null;
    if (localeTemplates) {
      await this.requireProjectTemplates(project.id, Object.values(localeTemplates));
    }

    const updated = await this.repos.campaigns.update(campaignId, {
      name: input.name,
      description: input.description,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      variablesSchema: input.variablesSchema,
      localeTemplates,
    });
    if (!updated) throw new NotFoundError("Trigger");
    return updated;
  }

  async delete(userId: string, campaignId: number): Promise<{ project: Project }> {
    const { project } = await this.requireCampaign(userId, campaignId, "write");
    await this.repos.campaigns.delete(campaignId);
    return { project };
  }

  // ---------------------------------------------------------------- API v1

  /** A page of the project's triggers, newest first. */
  async listPage(caller: Caller, projectId: number, page: PageRequest): Promise<Page<Campaign>> {
    await this.access.requireProject(caller, projectId, "read");
    return pageOf(
      await this.repos.campaigns.findTriggeredPage(projectId, page.limit + 1, page.beforeId),
      page.limit,
    );
  }

  /** One trigger; a campaign of another type is not one. */
  getTrigger(caller: Caller, campaignId: number): Promise<Campaign> {
    return this.getTriggerFor(caller, campaignId, "read");
  }

  /**
   * A trigger from API v1: its template (and locale templates) must be in
   * the project. With `dryRun` nothing is stored: the result is null.
   */
  async createFromApi(
    caller: Caller,
    projectId: number,
    rawInput: unknown,
    { dryRun = false }: { dryRun?: boolean } = {},
  ): Promise<Campaign | null> {
    await this.access.requireProject(caller, projectId, "write");
    const input = parseApiInput(ApiCreateTriggerSchema, rawInput);
    await this.requireApiTemplates(projectId, input.templateId, input.localeTemplates);
    if (dryRun) return null;

    return this.repos.campaigns.create({
      name: input.name,
      description: input.description ?? null,
      projectId,
      templateId: input.templateId,
      localeTemplates: input.localeTemplates ?? null,
      listId: null,
      type: "TRIGGERED",
      variablesSchema: input.variablesSchema ?? null,
      fromName: input.fromName ?? null,
      fromEmail: input.fromEmail ?? null,
      status: "DRAFT",
    });
  }

  /**
   * Changes the fields sent (API v1), the template included; null clears an
   * optional one. With `dryRun` nothing is stored: the result is null.
   */
  async updateFromApi(
    caller: Caller,
    campaignId: number,
    rawInput: unknown,
    { dryRun = false }: { dryRun?: boolean } = {},
  ): Promise<Campaign | null> {
    const campaign = await this.getTriggerFor(caller, campaignId, "write");
    const input = parseApiInput(ApiUpdateTriggerSchema, rawInput);
    await this.requireApiTemplates(campaign.projectId, input.templateId, input.localeTemplates);
    if (dryRun) return null;

    const updated = await this.repos.campaigns.update(campaignId, {
      name: input.name,
      description: input.description,
      templateId: input.templateId,
      localeTemplates: input.localeTemplates,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      variablesSchema: input.variablesSchema,
    });
    if (!updated) throw new NotFoundError("Trigger", campaignId);
    return updated;
  }

  private async getTriggerFor(caller: Caller, campaignId: number, action: AccessAction): Promise<Campaign> {
    const { campaign } = await this.requireCampaign(caller, campaignId, action);
    if (campaign.type !== "TRIGGERED") throw new NotFoundError("Trigger", campaignId);
    return campaign;
  }

  /**
   * The templates a trigger names through the API, each in the project. A
   * missing one is a field error at its path, so the caller knows which.
   */
  private async requireApiTemplates(
    projectId: number,
    templateId: number | undefined,
    localeTemplates: Record<string, number> | null | undefined,
  ): Promise<void> {
    const named: Array<[string, number]> = [
      ...(templateId !== undefined ? [["templateId", templateId] as [string, number]] : []),
      ...Object.entries(localeTemplates ?? {}).map(([locale, id]) => [`localeTemplates.${locale}`, id] as [string, number]),
    ];
    const issues = [];
    for (const [path, id] of named) {
      const template = await this.repos.templates.findById(id);
      if (!template || template.projectId !== projectId) {
        issues.push({ path, code: "not_found", message: `No template ${id} in this workspace.` });
      }
    }
    if (issues.length > 0) {
      throw new ValidationError(
        issues.length === 1 ? `${issues[0].path}: ${issues[0].message}` : `The request has ${issues.length} invalid fields.`,
        { issues, issueCount: issues.length },
        "Use the id of a template in this workspace: GET /api/v1/templates lists them.",
      );
    }
  }

  /**
   * Every template a trigger points at - the default one and each locale
   * variant - must live in the trigger's own project. The ids arrive from
   * the form, and the send path would otherwise render whatever they name.
   */
  private async requireProjectTemplates(
    projectId: number,
    templateIds: Array<number | null | undefined>,
  ): Promise<void> {
    for (const templateId of templateIds) {
      if (templateId == null) continue;
      this.access.requireSameProject(
        projectId,
        await this.repos.templates.findById(Number(templateId)),
        "Template",
      );
    }
  }
}
