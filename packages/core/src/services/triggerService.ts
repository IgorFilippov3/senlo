import {
  ICampaignRepository,
  IEmailTemplateRepository,
  IEmailProviderRepository,
  IProjectRepository,
  ITriggeredSendLogRepository,
} from "../ports";
import { replaceMergeTags } from "../merge-tags";
import type { MailSettings } from "../config";
import type { TriggeredSendLog } from "../domain";
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
import { fixedBaseUrl, resolveProjectBaseUrl, type ResolveBaseUrl } from "../base-url";

export interface TriggeredEmailOptions {
  campaignId: number;
  projectId: number; // For security validation
  to: string;
  data?: Record<string, unknown>;
  locale?: string;
  subject?: string;
  /**
   * For a sender that may retry the same send (an automation step): a send
   * with a key already used queues nothing new and returns the first one's
   * log. Not part of the public API.
   */
  dedupeKey?: string;
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
      "linkSigningSecret" | "defaultFromEmail" | "appUrl"
    >,
    private readonly hooks: ServiceHooks = ServiceHooks.none,
    /** Where this project's links point; see `ResolveBaseUrl`. */
    private readonly resolveBaseUrl: ResolveBaseUrl = fixedBaseUrl(settings.appUrl),
  ) {}

  /** The public API entry: the body as received, the project from the API key. */
  async sendFromRequest(projectId: number, rawBody: unknown) {
    const request = parseInput(TriggeredEmailRequestSchema, rawBody);
    return this.sendTriggeredEmail({ ...request, projectId });
  }

  async sendTriggeredEmail(options: TriggeredEmailOptions) {
    const { campaignId, to, data, locale, subject: subjectOverride, dedupeKey } = options;

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

    // A repeat of a send already accepted: not checked against the plan
    // again (it was, the first time) and not counted again.
    const earlier = dedupeKey ? await this.logRepo.findByDedupeKey(dedupeKey) : null;
    if (!earlier) {
      // Refused here, before a send log exists, so the API caller gets the reason.
      await this.hooks.requireQuota({ type: "email.send", projectId: project.id });
    }

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
    const baseUrl = await resolveProjectBaseUrl(this.resolveBaseUrl, project.id);
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

    const logData = {
      campaignId: campaign.id,
      email: to,
      status: "PENDING" as const,
      error: null,
      data: data,
    };
    let log: TriggeredSendLog;
    let fresh = true;
    if (dedupeKey) {
      ({ log, created: fresh } = earlier ? { log: earlier, created: false } : await this.logRepo.createOnce(logData, dedupeKey));
    } else {
      log = await this.logRepo.create(logData);
    }

    // A repeat whose email has left the queue (sent or failed) sends nothing.
    // One still PENDING is queued again under the same job id: BullMQ ignores
    // the add while the first job exists, and resends only if it was lost
    // between the log row and the queue.
    if (!fresh && log.status !== "PENDING") {
      return { success: true, jobId: undefined, logId: log.id, duplicate: true };
    }

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
      },
      // One job per log row: a repeat of a deduplicated send cannot queue a second.
      { jobId: `triggered-log-${log.id}` },
    );

    return {
      success: true,
      jobId: job.id,
      logId: log.id,
      duplicate: !fresh,
    };
  }
}
