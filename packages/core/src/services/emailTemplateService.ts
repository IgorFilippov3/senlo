// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { z } from "zod";
import { AccessGuard, type AccessAction } from "../access";
import { ServiceHooks } from "../hooks";
import { fixedBaseUrl, resolveProjectBaseUrl, type ResolveBaseUrl } from "../base-url";
import type { MailSettings } from "../config";
import { EMPTY_EMAIL_DESIGN } from "../constants";
import type { Campaign, EmailProvider, Project } from "../domain";
import type { EmailDesignDocument } from "../emailDesign";
import type {
  EmailTemplate,
  EmailTemplateVersion,
  EmailTemplateVersionSummary,
  TemplateVersionSource,
} from "../emailTemplate";
import { sameJson } from "../canonical-json";
import { NotFoundError, ProviderError, RecipientNotAllowedError, ValidationError } from "../errors";
import { auditActor, isApiCaller, type Caller } from "../caller";
import type { MergeTag } from "../merge-tags";
import type {
  ICampaignRepository,
  IEmailProviderRepository,
  IEmailTemplateRepository,
  IMailer,
  IProjectRepository,
  ITemplateVersionRepository,
} from "../ports";
import { htmlToPlainText } from "../renderer/htmlToText";
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
  templateVersions: ITemplateVersionRepository;
}

/** At most this many versions in a template's history list. */
export const TEMPLATE_VERSION_LIST_LIMIT = 100;

/** Where a caller's save comes from: the editor, or API v1 (`mcp` when the client says so). */
export function versionSource(caller: Caller): Exclude<TemplateVersionSource, "baseline"> {
  if (!isApiCaller(caller)) return "editor";
  return caller.client?.toLowerCase().startsWith("mcp") ? "mcp" : "api";
}

/** The part of a template a version keeps: what the recipient gets. */
interface TemplateContent {
  design: EmailDesignDocument;
  subject: string;
  preheader: string | null;
}

function contentOf(template: Pick<EmailTemplate, "designJson" | "subject" | "preheader">): TemplateContent {
  return {
    design: template.designJson ?? EMPTY_EMAIL_DESIGN,
    subject: template.subject,
    preheader: template.preheader || null,
  };
}

function sameContent(a: TemplateContent, b: TemplateContent): boolean {
  return a.subject === b.subject && (a.preheader || null) === (b.preheader || null) && sameJson(a.design, b.design);
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
    /** The adapter that sends through a provider (`MailerFactory.create`). */
    private readonly mailerFor: (provider: EmailProvider) => IMailer,
    private readonly settings: Pick<MailSettings, "appUrl" | "defaultFromEmail">,
    access?: AccessGuard,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
    /** Where a project's links and relative images point; see `ResolveBaseUrl`. */
    private readonly resolveBaseUrl: ResolveBaseUrl = fixedBaseUrl(settings.appUrl),
  ) {
    this.access = access ?? new AccessGuard(repos.projects);
  }

  /** The template and its project, if the caller may do `action` on them. */
  async requireTemplate(
    caller: Caller,
    templateId: number,
    action: AccessAction,
  ): Promise<{ template: EmailTemplate; project: Project }> {
    const template = await this.access.requireInProject(
      caller,
      await this.repos.templates.findById(templateId),
      "Template",
      action,
    );
    const project = await this.access.requireProject(caller, template.projectId, action);
    return { template, project };
  }

  async listProjectTemplates(caller: Caller, projectId: number): Promise<EmailTemplate[]> {
    await this.access.requireProject(caller, projectId, "read");
    return this.repos.templates.findByProject(projectId);
  }

  /** A new, empty template from form fields. */
  async create(caller: Caller, projectId: number, rawInput: unknown): Promise<EmailTemplate> {
    await this.access.requireProject(caller, projectId, "write");
    const input = parseInput(CreateTemplateSchema, rawInput);
    const template = await this.repos.templates.create({
      projectId,
      name: input.name,
      subject: input.subject,
      locale: input.locale,
      html: HTML_PLACEHOLDER,
      designJson: EMPTY_EMAIL_DESIGN,
    });
    await this.audit(caller, "created", template.id, projectId);
    return template;
  }

  /** The template must be in the project the caller named, which must be theirs. */
  async delete(userId: string, projectId: number, templateId: number): Promise<void> {
    await this.access.requireProject(userId, projectId, "write");
    this.access.requireSameProject(
      projectId,
      await this.repos.templates.findById(templateId),
      "Template",
    );
    await this.repos.templates.delete(templateId);
    await this.audit(userId, "deleted", templateId, projectId);
  }

  private audit(caller: Caller, verb: string, templateId: number, projectId: number) {
    return this.hooks.audit({
      actor: auditActor(caller),
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
    const { template, project } = await this.requireTemplate(userId, templateId, "read");

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
    const { template } = await this.requireTemplate(userId, templateId, "write");
    await this.recordVersion(
      template,
      {
        design: input.design,
        subject: input.metadata?.subject ?? template.subject,
        preheader: input.metadata ? (input.metadata.preheader ?? null) : template.preheader,
      },
      userId,
    );
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
   * Stores what is about to be saved as the template's next version, before
   * the template itself changes: if that write then fails, retrying the same
   * save finds an identical version and adds no second one. Nothing changed
   * since the last version, nothing is stored. A template with no history yet
   * first gets a `baseline` version of what it had, unless that was the empty
   * design of a new template.
   */
  private async recordVersion(before: EmailTemplate, next: TemplateContent, caller: Caller): Promise<void> {
    const versions = this.repos.templateVersions;
    const latest = await versions.latest(before.id);

    if (latest) {
      if (sameContent(latest, next)) return;
    } else {
      const current = contentOf(before);
      if (before.designJson && !sameJson(before.designJson, EMPTY_EMAIL_DESIGN) && !sameContent(current, next)) {
        await versions.append({ templateId: before.id, ...current, source: "baseline" });
      }
    }

    await versions.append({
      templateId: before.id,
      ...next,
      source: versionSource(caller),
      createdByUserId: !isApiCaller(caller) ? caller : "userId" in caller.actor ? caller.actor.userId : null,
      createdByApiKeyId: isApiCaller(caller) && "apiKeyId" in caller.actor ? caller.actor.apiKeyId : null,
    });
  }

  /** The template's versions, newest first, without their designs. */
  async listVersions(caller: Caller, templateId: number): Promise<EmailTemplateVersionSummary[]> {
    await this.requireTemplate(caller, templateId, "read");
    return this.repos.templateVersions.listByTemplate(templateId, TEMPLATE_VERSION_LIST_LIMIT);
  }

  /** One version with its design, to restore in the editor. Must belong to `templateId`. */
  async getVersion(caller: Caller, templateId: number, versionId: number): Promise<EmailTemplateVersion> {
    await this.requireTemplate(caller, templateId, "read");
    const version = await this.repos.templateVersions.findById(versionId);
    if (!version || version.templateId !== templateId) throw new NotFoundError("Template version", versionId);
    return version;
  }

  /**
   * Sends the editor's test email now, through the workspace's provider, and
   * answers with what the provider said: no queue, no retries. A refusal
   * comes back with the provider's reason; no answer within
   * `TEST_SEND_TIMEOUT_MS` is an error that says the email may still arrive.
   * Counted like any send (quota, usage) and written to the audit log; not to
   * a trigger's send log, which a test does not belong to.
   */
  async sendTest(
    caller: Caller,
    templateId: number,
    input: TestSendInput,
  ): Promise<{ messageId?: string }> {
    const { template, project } = await this.requireTemplate(caller, templateId, "write");

    if (!SINGLE_ADDRESS.test(input.to)) {
      throw new ValidationError("Enter a single valid recipient address.");
    }
    // The editor may test on any address; an API caller (a coding agent)
    // only on the organization's own, so it cannot mail strangers.
    if (isApiCaller(caller)) {
      const allowed = await this.access.testRecipients(project);
      if (!allowed.includes(input.to.trim().toLowerCase())) throw new RecipientNotAllowedError(allowed);
    }
    if (input.from && !SINGLE_ADDRESS.test(input.from)) {
      throw new ValidationError("Enter a single valid sender address.");
    }
    if (!project.providerId) {
      throw new ValidationError(
        "No email provider is selected for this workspace. Choose one in Settings → Email Provider, or add one on the Providers page first.",
      );
    }
    // Through the policy, like every provider check: an organization's
    // provider is usable by its members. Sending through it changes nothing
    // about the provider, so reading it is enough (the template needed write).
    const provider = await this.access.requireOwned(
      caller,
      await this.repos.providers.findById(project.providerId),
      "Email provider",
      "read",
    );
    await this.hooks.requireQuota({ type: "email.send", projectId: project.id });

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

    const result = await withTimeout(
      this.mailerFor(provider).send({
        from: input.from || this.settings.defaultFromEmail,
        to: input.to,
        subject: `[TEST] ${input.subject || template.subject || "No Subject"}`,
        html,
        text: htmlToPlainText(html),
        tags: { project_id: String(project.id), campaign_id: "0", contact_id: "0" },
        stream: "transactional",
      }),
      TEST_SEND_TIMEOUT_MS,
    );

    const outcome = !result
      ? { success: false, error: `No answer from ${provider.type} within ${TEST_SEND_TIMEOUT_MS / 1000} seconds` }
      : result;
    await this.hooks.audit({
      actor: auditActor(caller),
      action: "template.test_sent",
      target: { type: "template", id: templateId, projectId: project.id },
      details: outcome.success
        ? { provider: provider.type, success: true }
        : { provider: provider.type, success: false, error: outcome.error },
    });

    if (!result) {
      throw new ProviderError(
        `The provider did not answer within ${TEST_SEND_TIMEOUT_MS / 1000} seconds. The email may still arrive; check the provider's logs.`,
      );
    }
    if (!result.success) {
      throw new ProviderError(`The provider refused the test email: ${result.error || "no reason given"}`);
    }
    await this.hooks.recordUsage({ type: "email.sent", projectId: project.id, campaignId: null, provider: provider.type, test: true });
    return { messageId: result.messageId };
  }
}

/** How long the editor waits for the provider to accept a test email. */
export const TEST_SEND_TIMEOUT_MS = 15_000;

/** The promise's value, or null when it takes longer than `ms`. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
