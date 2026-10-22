// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Queue } from "bullmq";
import { z } from "zod";
import { AccessGuard } from "../access";
import { ServiceHooks } from "../hooks";
import { fixedBaseUrl, resolveProjectBaseUrl, type ResolveBaseUrl } from "../base-url";
import type { MailSettings } from "../config";
import { EMPTY_EMAIL_DESIGN } from "../constants";
import type { Campaign, Project } from "../domain";
import type { EmailDesignDocument } from "../emailDesign";
import type { EmailTemplate } from "../emailTemplate";
import { NotFoundError, ValidationError } from "../errors";
import type { MergeTag } from "../merge-tags";
import type {
  ICampaignRepository,
  IEmailProviderRepository,
  IEmailTemplateRepository,
  IProjectRepository,
} from "../ports";
import type { EmailJobData } from "../queue/types";
import { renderEmailDesign } from "../renderer/renderEmailDesign";
import { parseInput } from "../validation";

export const CreateTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  subject: z.string().trim().min(1, "Subject is required").max(255),
  locale: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || "en"),
});

export type CreateTemplateInput = z.input<typeof CreateTemplateSchema>;

/** What the editor hands back on save. */
export interface EditorSaveInput {
  design: EmailDesignDocument;
  html: string;
  metadata?: {
    name: string;
    subject: string;
    locale?: string;
    preheader?: string | null;
  };
}

export interface TestSendInput {
  to: string;
  from?: string;
  design: EmailDesignDocument;
  subject?: string;
}

/** Everything the editor page needs, loaded with one access check. */
export interface EditorData {
  template: EmailTemplate;
  project: Project;
  /** The trigger the template belongs to, for its variables; null for a plain template. */
  campaign: Campaign | null;
  design: EmailDesignDocument;
  mergeTags: MergeTag[];
  /** The project's public address, for the editor's preview, export and relative images. */
  baseUrl: string;
}

/**
 * One plain address: no display name, no list, and nothing that could end a
 * header line. The test-send addresses come straight from the client.
 */
const SINGLE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

const HTML_PLACEHOLDER = "<p>Empty template</p>";

export interface TemplateServiceRepositories {
  templates: IEmailTemplateRepository;
  projects: IProjectRepository;
  campaigns: Pick<ICampaignRepository, "findById" | "findByTemplateId">;
  providers: Pick<IEmailProviderRepository, "findById">;
}

/** A trigger's variables as merge tags for the editor's picker. */
export function mergeTagsFromVariables(
  variablesSchema: Record<string, unknown> | null | undefined,
): MergeTag[] {
  if (!variablesSchema) return [];
  return Object.keys(variablesSchema).map((key) => ({
    label: key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    value: `{{${key}}}`,
    category: "custom",
  }));
}

/**
 * Email templates: the list, create and delete inside a project, what the
 * editor loads and saves, and test sends.
 */
export class TemplateService {
  private readonly access: AccessGuard;

  constructor(
    private readonly repos: TemplateServiceRepositories,
    private readonly emailQueue: Pick<Queue<EmailJobData>, "add" | "getWorkers">,
    private readonly settings: Pick<MailSettings, "appUrl" | "defaultFromEmail">,
    access?: AccessGuard,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
    /** Where a project's links and relative images point; see `ResolveBaseUrl`. */
    private readonly resolveBaseUrl: ResolveBaseUrl = fixedBaseUrl(settings.appUrl),
  ) {
    this.access = access ?? new AccessGuard(repos.projects);
  }

  /** The template and its project, if the user may access them. */
  async requireTemplate(
    userId: string,
    templateId: number,
  ): Promise<{ template: EmailTemplate; project: Project }> {
    const template = await this.access.requireInProject(
      userId,
      await this.repos.templates.findById(templateId),
      "Template",
    );
    const project = await this.access.requireProject(userId, template.projectId);
    return { template, project };
  }

  async listProjectTemplates(userId: string, projectId: number): Promise<EmailTemplate[]> {
    await this.access.requireProject(userId, projectId);
    return this.repos.templates.findByProject(projectId);
  }

  /** A new, empty template from form fields. */
  async create(userId: string, projectId: number, rawInput: unknown): Promise<EmailTemplate> {
    await this.access.requireProject(userId, projectId);
    const input = parseInput(CreateTemplateSchema, rawInput);
    const template = await this.repos.templates.create({
      projectId,
      name: input.name,
      subject: input.subject,
      locale: input.locale,
      html: HTML_PLACEHOLDER,
      designJson: EMPTY_EMAIL_DESIGN,
    });
    await this.audit(userId, "created", template.id, projectId);
    return template;
  }

  /** The template must be in the project the caller named, which must be theirs. */
  async delete(userId: string, projectId: number, templateId: number): Promise<void> {
    await this.access.requireProject(userId, projectId);
    this.access.requireSameProject(
      projectId,
      await this.repos.templates.findById(templateId),
      "Template",
    );
    await this.repos.templates.delete(templateId);
    await this.audit(userId, "deleted", templateId, projectId);
  }

  private audit(userId: string, verb: string, templateId: number, projectId: number) {
    return this.hooks.audit({
      actor: { userId },
      action: `template.${verb}`,
      target: { type: "template", id: templateId, projectId },
    });
  }

  /**
   * The editor's data. `campaignId`, when given, must be a trigger of the same
   * project; otherwise the trigger using the template, if any.
   */
  async loadEditorData(
    userId: string,
    templateId: number,
    campaignId?: number | null,
  ): Promise<EditorData> {
    const { template, project } = await this.requireTemplate(userId, templateId);

    let campaign = campaignId
      ? await this.repos.campaigns.findById(campaignId)
      : await this.repos.campaigns.findByTemplateId(templateId);
    if (campaign && campaign.projectId !== template.projectId) campaign = null;

    return {
      template,
      project,
      campaign,
      design: template.designJson ?? EMPTY_EMAIL_DESIGN,
      mergeTags: mergeTagsFromVariables(campaign?.variablesSchema),
      baseUrl: await resolveProjectBaseUrl(this.resolveBaseUrl, project.id),
    };
  }

  async saveFromEditor(
    userId: string,
    templateId: number,
    input: EditorSaveInput,
  ): Promise<EmailTemplate> {
    const { template } = await this.requireTemplate(userId, templateId);
    const updated = await this.repos.templates.update({
      id: templateId,
      designJson: input.design,
      html: input.html,
      name: input.metadata?.name,
      subject: input.metadata?.subject,
      locale: input.metadata?.locale,
      preheader: input.metadata?.preheader,
    });
    if (!updated) throw new NotFoundError("Template");
    await this.audit(userId, "saved", templateId, template.projectId);
    return updated;
  }

  /**
   * Renders the design for a stand-in recipient and queues it through the
   * project's provider. Nothing is logged against a campaign.
   */
  async sendTest(
    userId: string,
    templateId: number,
    input: TestSendInput,
  ): Promise<{ jobId: string | undefined; activeWorkers: number }> {
    const { template, project } = await this.requireTemplate(userId, templateId);

    if (!SINGLE_ADDRESS.test(input.to)) {
      throw new ValidationError("Enter a single valid recipient address.");
    }
    if (input.from && !SINGLE_ADDRESS.test(input.from)) {
      throw new ValidationError("Enter a single valid sender address.");
    }
    if (!project.providerId) {
      throw new ValidationError(
        "No email provider configured for this project. Please set one in Project Settings.",
      );
    }
    // Through the policy, like every provider check: an organization's
    // provider is usable by its members.
    await this.access.requireOwned(
      userId,
      await this.repos.providers.findById(project.providerId),
      "Email provider",
    );

    const html = renderEmailDesign(input.design, {
      baseUrl: await resolveProjectBaseUrl(this.resolveBaseUrl, project.id),
      data: {
        contact: {
          email: input.to,
          name: "Test Recipient",
          first_name: "Test",
          last_name: "Recipient",
        },
        project: { name: project.name },
        unsubscribeUrl: "#test-unsubscribe",
      },
    });

    const job = await this.emailQueue.add(`test-email-${templateId}-${Date.now()}`, {
      projectId: project.id,
      campaignId: 0, // 0: a test, not a campaign
      contactId: 0,
      email: input.to,
      from: input.from || this.settings.defaultFromEmail,
      subject: `[TEST] ${input.subject || template.subject || "No Subject"}`,
      html,
      providerId: project.providerId,
    });

    const workers = await this.emailQueue.getWorkers();
    return { jobId: job.id, activeWorkers: workers.length };
  }
}
