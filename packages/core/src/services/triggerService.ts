import {
  ICampaignRepository,
  IEmailTemplateRepository,
  IEmailProviderRepository,
  IProjectRepository,
  ITriggeredSendLogRepository,
} from "../ports";
import { replaceMergeTags } from "../merge-tags";
import type { MailSettings } from "../config";
import {
  encodeUnsubscribeToken,
  buildUnsubscribeHeaders,
  unsubscribeUrls,
} from "../unsubscribe-token";
import { Queue } from "bullmq";
import { z } from "zod";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { ServiceHooks } from "../hooks";

export interface TriggeredEmailOptions {
  campaignId: number;
  projectId: number; // For security validation
  to: string;
  data?: Record<string, unknown>;
  locale?: string;
  subject?: string;
  baseUrl: string;
}

/** Body of `POST /api/triggered`. `id` wins over its older alias `campaignId`. */
export const TriggeredEmailRequestSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    campaignId: z.union([z.number(), z.string()]).optional(),
    to: z.string().trim().min(1, "to (email) is required").email(),
    data: z.record(z.unknown()).optional(),
    locale: z.string().optional(),
    subject: z.string().optional(),
  })
  .transform(({ id, campaignId, ...rest }, ctx) => {
    const raw = id ?? campaignId;
    const resolved = raw === undefined || raw === "" ? NaN : Number(raw);
    if (!Number.isInteger(resolved) || resolved <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["id"], message: "id (trigger id) is required" });
      return z.NEVER;
    }
    return { campaignId: resolved, ...rest };
  });

export type TriggeredEmailRequest = z.output<typeof TriggeredEmailRequestSchema>;

export class TriggerService {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly templateRepo: IEmailTemplateRepository,
    private readonly providerRepo: IEmailProviderRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly logRepo: ITriggeredSendLogRepository,
    private readonly emailQueue: Queue,
    private readonly settings: Pick<
      MailSettings,
      "linkSigningSecret" | "defaultFromEmail"
    >,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
  ) {}

  /** The public API entry: the body as received, the project from the API key. */
  async sendFromRequest(projectId: number, rawBody: unknown, baseUrl: string) {
    const request = parseInput(TriggeredEmailRequestSchema, rawBody);
    return this.sendTriggeredEmail({ ...request, projectId, baseUrl });
  }

  async sendTriggeredEmail(options: TriggeredEmailOptions) {
    const { campaignId, to, data, locale, subject: subjectOverride, baseUrl } = options;

    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || campaign.projectId !== options.projectId) {
      throw new NotFoundError("Campaign");
    }

    if (campaign.type !== "TRIGGERED") {
      throw new ValidationError("This campaign is not configured for API triggers");
    }

    // Locale-based template selection
    let templateId = campaign.templateId;
    if (
      locale &&
      campaign.localeTemplates &&
      campaign.localeTemplates[locale]
    ) {
      templateId = campaign.localeTemplates[locale];
    }

    const [template, project] = await Promise.all([
      this.templateRepo.findById(templateId),
      this.projectRepo.findById(campaign.projectId),
    ]);

    // A locale template is an id stored on the campaign; one from another
    // project must never be rendered here.
    if (!template || template.projectId !== campaign.projectId) {
      throw new NotFoundError("Template");
    }
    if (!project) throw new NotFoundError("Project");
    // Refused here, before a send log exists, so the API caller gets the reason.
    await this.hooks.requireQuota({ type: "email.send", projectId: project.id });

    if (!project.providerId) {
      throw new ValidationError("No email provider configured for this project");
    }

    const provider = await this.providerRepo.findById(project.providerId);
    if (!provider) {
      throw new NotFoundError("Email provider");
    }

    // A triggered recipient may have no contact row, so the token carries the
    // project and the address. Without this the unsubscribe tag rendered as
    // "#" and the link did nothing.
    const unsubscribeToken = await encodeUnsubscribeToken(
      { projectId: project.id, email: to, campaignId: campaign.id },
      this.settings.linkSigningSecret,
    );
    const unsubscribe = unsubscribeUrls(baseUrl, unsubscribeToken);

    const fromEmail = campaign.fromEmail || this.settings.defaultFromEmail;
    const fromAddress = campaign.fromName
      ? `${campaign.fromName} <${fromEmail}>`
      : fromEmail;

    // Prepare subject with merge tags support
    const rawSubject = subjectOverride || template.subject;
    // A subject line is plain text, so HTML escaping would show entities to
    // the recipient.
    const personalizedSubject = replaceMergeTags(
      rawSubject,
      {
        custom: data,
        contact: { email: to, ...data },
        project: { name: project.name },
      },
      undefined,
      { escape: false },
    );

    const log = await this.logRepo.create({
      campaignId: campaign.id,
      email: to,
      status: "PENDING",
      error: null,
      data: data,
    });

    const job = await this.emailQueue.add(
      `triggered-${campaign.id}-${to}-${Date.now()}`,
      {
        projectId: project.id,
        campaignId: campaign.id,
        contactId: null,
        logId: log.id,
        email: to,
        from: fromAddress,
        subject: personalizedSubject,
        providerId: project.providerId,
        replyTo: campaign.replyTo || undefined,
        // Rendering happens in the send worker, the same as for a campaign, so
        // the job carries what to render rather than the rendered message.
        templateId: template.id,
        baseUrl,
        preheader: campaign.preheader || template.preheader || undefined,
        title: subjectOverride || template.subject,
        renderData: {
          custom: data,
          contact: { email: to, ...data },
          unsubscribeUrl: unsubscribe.page,
        },
        unsubscribePageUrl: unsubscribe.page,
        unsubscribeOneClickUrl: unsubscribe.oneClick,
        html: template.designJson ? undefined : template.html,
      },
    );

    return {
      success: true,
      jobId: job.id,
      logId: log.id,
    };
  }
}
