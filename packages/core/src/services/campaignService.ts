// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

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
import { NotFoundError } from "../errors";
import type {
  ICampaignRepository,
  IEmailTemplateRepository,
  IProjectRepository,
  ITriggeredSendLogRepository,
} from "../ports";
import { parseInput } from "../validation";

const optionalId = z.preprocess(
  (val) => (val === "" ? undefined : val),
  z.coerce.number().int().positive(),
);

/** A sender address from a form field; an empty field means "no sender of its own". */
const optionalEmail = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? null : val),
  z.string().trim().email().nullable().optional(),
);

/** A JSON string from a form field; anything unparsable becomes null. */
const jsonField = z
  .string()
  .optional()
  .transform((val): Record<string, unknown> | null => {
    if (!val) return null;
    try {
      const parsed: unknown = JSON.parse(val);
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
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

  /** The campaign and its project, if the user may do `action` on them. */
  async requireCampaign(
    userId: string,
    campaignId: number,
    action: AccessAction,
  ): Promise<{ campaign: Campaign; project: Project }> {
    const campaign = await this.access.requireInProject(
      userId,
      await this.repos.campaigns.findById(campaignId),
      "Trigger",
      action,
    );
    const project = await this.access.requireProject(userId, campaign.projectId, action);
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
    await this.requireCampaign(userId, campaignId, "read");
    return this.repos.campaigns.getTimeSeriesStatsByCampaign(campaignId, options);
  }

  /** Every campaign across the user's projects. */
  async listForUser(userId: string): Promise<Campaign[]> {
    const projects = await listInScope(await this.access.scopeFor(userId), this.repos.projects);
    const perProject = await Promise.all(
      projects.map((p) => this.repos.campaigns.findByProject(p.id)),
    );
    return perProject.flat();
  }

  async listForProject(userId: string, projectId: number): Promise<Campaign[]> {
    await this.access.requireProject(userId, projectId, "read");
    return this.repos.campaigns.findByProject(projectId);
  }

  /** Raw form fields in. */
  async createTriggered(userId: string, rawInput: unknown): Promise<Campaign> {
    const input = parseInput(CreateTriggeredCampaignSchema, rawInput);
    await this.access.requireProject(userId, input.projectId, "write");
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

  async updateTriggered(userId: string, campaignId: number, rawInput: unknown): Promise<Campaign> {
    const { project } = await this.requireCampaign(userId, campaignId, "write");
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
