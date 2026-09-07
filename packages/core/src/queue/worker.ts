import { Worker, Job, Queue } from "bullmq";
import { redis } from "../redis";
import type { EmailJobData, CampaignJobData, AutomationJobData } from "./types";
import {
  ICampaignRepository,
  IEmailProviderRepository,
  ITriggeredSendLogRepository,
  ISuppressionRepository,
  IEmailTemplateRepository,
  IProjectRepository,
  RecipientListRepository,
} from "../ports";
import { MailerFactory } from "../services/mail/index";
import {
  encodeUnsubscribeToken,
  buildUnsubscribeHeaders,
  unsubscribeUrls,
} from "../unsubscribe-token";
import { htmlToPlainText, EMAIL_CLIPPING_BYTES } from "../renderer/htmlToText";
import {
  personalizeEmail,
  isRecipientIndependent,
} from "../renderer/personalize";
import type { EmailTemplate } from "../emailTemplate";
import { renderEmailDesign } from "../renderer/renderEmailDesign";
import type { EmailDesignDocument } from "../emailDesign";
import { AutomationService } from "../services/automationService";
import { AUTOMATION_QUEUE_NAME } from "./queue";

/**
 * How long a rendered campaign template is reused inside one worker process.
 * Short enough that editing a template mid-send is picked up quickly, long
 * enough that a campaign of any size renders once rather than once per message.
 */
const RENDER_CACHE_TTL_MS = 5 * 60 * 1000;
const RENDER_CACHE_MAX_ENTRIES = 20;

interface CachedRender {
  html: string;
  expiresAt: number;
}

export class EmailWorkerProcessor {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly providerRepo: IEmailProviderRepository,
    private readonly templateRepo: IEmailTemplateRepository,
    private readonly projectRepo: IProjectRepository,
    private readonly listRepo: RecipientListRepository,
    private readonly emailQueue: Queue<EmailJobData>,
    private readonly logRepo?: ITriggeredSendLogRepository,
    private readonly suppressionRepo?: ISuppressionRepository,
  ) {}

  /**
   * Templates rendered without recipient data, keyed by campaign and template.
   * Only documents that render the same way for everyone land here: a condition
   * is evaluated against the recipient and a loop repeats a row from their
   * data, so those are still rendered per message.
   */
  private readonly renderCache = new Map<string, CachedRender>();

  private cachedRender(key: string): string | undefined {
    const entry = this.renderCache.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt < Date.now()) {
      this.renderCache.delete(key);
      return undefined;
    }

    return entry.html;
  }

  private cacheRender(key: string, html: string) {
    if (this.renderCache.size >= RENDER_CACHE_MAX_ENTRIES) {
      const oldest = this.renderCache.keys().next().value;
      if (oldest !== undefined) this.renderCache.delete(oldest);
    }

    this.renderCache.set(key, {
      html,
      expiresAt: Date.now() + RENDER_CACHE_TTL_MS,
    });
  }

  /**
   * The document with merge tags still in place. Rendered once per campaign
   * when the result does not depend on who receives it, and per message when
   * it does.
   */
  private async renderTemplate(
    templateId: number,
    campaignId: number,
    options: { baseUrl?: string; preheader?: string; title?: string },
  ): Promise<{ html: string; recipientIndependent: boolean }> {
    const cacheKey = `${campaignId}:${templateId}`;
    const cached = this.cachedRender(cacheKey);
    if (cached !== undefined) {
      return { html: cached, recipientIndependent: true };
    }

    const template = (await this.templateRepo.findById(
      templateId,
    )) as EmailTemplate | null;
    if (!template) throw new Error(`Template ${templateId} not found`);

    if (!template.designJson) {
      // Nothing to render: an imported template is already HTML.
      return { html: template.html, recipientIndependent: true };
    }

    const design = template.designJson as EmailDesignDocument;
    const html = renderEmailDesign(design, {
      baseUrl: options.baseUrl,
      preheader: options.preheader,
      title: options.title,
    });

    const recipientIndependent = isRecipientIndependent(design);
    if (recipientIndependent) {
      this.cacheRender(cacheKey, html);
    }

    return { html, recipientIndependent };
  }

  /**
   * The message for one recipient.
   *
   * Rendering happens here rather than when the job is queued. A campaign used
   * to render the document once per contact and put the result into the job, so
   * Redis held one full copy of the email per recipient; the job now carries an
   * id and this recipient's values, and the shared part of the work is done
   * once. A job queued the old way still carries `html` and is sent as-is.
   */
  private async buildMessageHtml(data: EmailJobData): Promise<string> {
    if (data.html) return data.html;

    if (!data.templateId) {
      throw new Error("Job has neither rendered HTML nor a template to render");
    }

    const { html: templateHtml } = await this.renderTemplate(
      data.templateId,
      data.campaignId,
      {
        baseUrl: data.baseUrl,
        preheader: data.preheader,
        title: data.title,
      },
    );

    const baseUrl = data.baseUrl;
    const emailEncoded = encodeURIComponent(data.email);

    const message = personalizeEmail(templateHtml, {
      data: data.renderData,
      clickTrackingBaseUrl: baseUrl
        ? `${baseUrl}/api/track/click/${data.campaignId}/${emailEncoded}`
        : undefined,
      skipTrackingUrls: data.unsubscribePageUrl
        ? [data.unsubscribePageUrl]
        : undefined,
      trackingPixelUrl: baseUrl
        ? `${baseUrl}/api/track/open/${data.campaignId}/${emailEncoded}`
        : undefined,
    });

    if (message.length > EMAIL_CLIPPING_BYTES) {
      console.warn(
        `[Worker] Message for ${data.email} is ${message.length} bytes; Gmail clips past ${EMAIL_CLIPPING_BYTES} and hides everything after the cut`,
      );
    }

    return message;
  }

  async processEmailJob(job: Job<EmailJobData>) {
    const {
      projectId,
      campaignId,
      contactId,
      logId,
      email,
      from,
      subject,
      providerId,
      replyTo,
      unsubscribeOneClickUrl,
    } = job.data;

    try {
      // 1. Check suppression list if repository is provided
      if (this.suppressionRepo) {
        const isSuppressed = await this.suppressionRepo.findByProjectAndEmail(
          projectId,
          email,
        );

        if (isSuppressed) {
          const reason = `Recipient is suppressed (Reason: ${isSuppressed.reason})`;
          console.warn(`[Worker] Skipping email to ${email}: ${reason}`);

          if (logId && this.logRepo) {
            await this.logRepo.update(logId, {
              status: "FAILED",
              error: reason,
            });
          }

          if (campaignId !== 0) {
            await this.campaignRepo.logEvent({
              campaignId,
              contactId: contactId && contactId !== 0 ? contactId : null,
              email,
              type: "FAILED",
              metadata: { error: reason },
            });
          }

          return; // Stop processing
        }
      }

      const provider = await this.providerRepo.findById(providerId);
      if (!provider) throw new Error(`Provider ${providerId} not found`);

      const html = await this.buildMessageHtml(job.data);

      const mailer = MailerFactory.create(provider);

      const result = await mailer.send({
        from,
        to: email,
        subject,
        html,
        // Built here rather than at queue time: deriving it from the HTML in
        // the job keeps the job payload from carrying a second copy of the
        // message body.
        text: htmlToPlainText(html),
        replyTo,
        headers: buildUnsubscribeHeaders(unsubscribeOneClickUrl),
        tags: {
          project_id: String(projectId),
          campaign_id: String(campaignId),
          contact_id: contactId ? String(contactId) : "0",
        },
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send email");
      }

      // Update log with provider message ID if it's a triggered send
      if (logId && this.logRepo) {
        const currentLog = await this.logRepo.findById(logId);
        // Only update to SUCCESS if it's still PENDING to avoid overwriting webhooks
        const newStatus =
          currentLog &&
          ["DELIVERED", "BOUNCED", "COMPLAINED"].includes(currentLog.status)
            ? currentLog.status
            : "SUCCESS";

        await this.logRepo.update(logId, {
          providerMessageId: result.messageId,
          status: newStatus as any,
        });
      }

      if (campaignId !== 0) {
        await this.campaignRepo.logEvent({
          campaignId,
          contactId: contactId && contactId !== 0 ? contactId : null,
          email,
          type: "SENT",
          metadata: { provider: provider.type, messageId: result.messageId },
        });

        await this.campaignRepo.logEvent({
          campaignId,
          contactId: contactId && contactId !== 0 ? contactId : null,
          email,
          type: "DELIVERED",
          metadata: { deliveryTime: "0.1s" },
        });
      }
    } catch (error) {
      console.error(`Failed to process email job ${job.id}:`, error);

      if (campaignId !== 0) {
        await this.campaignRepo.logEvent({
          campaignId,
          contactId: contactId && contactId !== 0 ? contactId : null,
          email,
          type: "FAILED",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      throw error; // Rethrow to let BullMQ handle retries
    }
  }

  async processCampaignJob(job: Job<CampaignJobData>) {
    const { campaignId } = job.data;

    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    if (campaign.status === "COMPLETED") return;

    const project = await this.projectRepo.findById(campaign.projectId);
    if (!project) throw new Error(`Project ${campaign.projectId} not found`);

    if (!project.providerId) {
      throw new Error("No email provider configured for this workspace");
    }

    const [template, provider] = await Promise.all([
      this.templateRepo.findById(campaign.templateId),
      this.providerRepo.findById(project.providerId),
    ]);

    if (!template) throw new Error("Template not found");
    if (!provider) throw new Error("Email provider not found");

    if (!campaign.listId) {
      throw new Error("No recipient list selected for this campaign");
    }

    const contacts = await this.listRepo.getContacts(campaign.listId, true);

    if (contacts.length === 0) {
      console.warn(
        `[Worker] Campaign ${campaignId} has no recipients, marking as completed`,
      );
      await this.campaignRepo.update(campaignId, { status: "COMPLETED" });
      return;
    }

    console.log(
      `[Worker] Starting campaign ${campaignId} send to ${contacts.length} recipients`,
    );

    await this.campaignRepo.update(campaignId, {
      status: "SENDING",
      sentAt: new Date(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fromAddress = campaign.fromName
      ? `${campaign.fromName} <${campaign.fromEmail || "hello@senlo.io"}>`
      : campaign.fromEmail || "hello@senlo.io";

    // Queue jobs in chunks to avoid memory issues and BullMQ limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < contacts.length; i += CHUNK_SIZE) {
      const chunk = contacts.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (contact) => {
          const unsubscribeToken = encodeUnsubscribeToken({
            contactId: contact.id,
            projectId: project.id,
            email: contact.email,
            campaignId: campaign.id,
          });
          const unsubscribe = unsubscribeUrls(baseUrl, unsubscribeToken);

          return this.emailQueue.add(
            `campaign-${campaign.id}-${contact.id}-${Date.now()}`,
            {
              projectId: project.id,
              campaignId: campaign.id,
              contactId: contact.id,
              email: contact.email,
              from: fromAddress,
              subject: campaign.subject || template.subject,
              providerId: project.providerId!,
              // What to render, rather than the render itself. The document is
              // rendered in the send worker: once for the whole campaign when
              // it looks the same for everyone, and per message when a
              // condition or a loop makes it depend on the recipient.
              templateId: template.id,
              baseUrl,
              preheader: campaign.preheader || template.preheader || undefined,
              title: campaign.subject || template.subject,
              renderData: {
                contact,
                unsubscribeUrl: unsubscribe.page,
              },
              unsubscribePageUrl: unsubscribe.page,
              unsubscribeOneClickUrl: unsubscribe.oneClick,
              // An imported template has no document to render from.
              html: template.designJson ? undefined : template.html,
            },
          );
        }),
      );
    }

    await this.campaignRepo.update(campaignId, { status: "COMPLETED" });
    console.log(`[Worker] Campaign ${campaignId} queued successfully`);
  }
}

export function createEmailWorker(processor: EmailWorkerProcessor) {
  const queuePrefix = process.env.REDIS_QUEUE_PREFIX || "senlo";
  return new Worker(
    "email-queue",
    async (job: Job<EmailJobData>) => {
      await processor.processEmailJob(job);
    },
    {
      connection: redis as any, // Cast to any to resolve version mismatch between BullMQ and ioredis
      prefix: queuePrefix,
    },
  );
}

export function createCampaignWorker(processor: EmailWorkerProcessor) {
  const queuePrefix = process.env.REDIS_QUEUE_PREFIX || "senlo";
  return new Worker(
    "campaign-queue",
    async (job: Job<CampaignJobData>) => {
      await processor.processCampaignJob(job);
    },
    {
      connection: redis as any,
      prefix: queuePrefix,
    },
  );
}

export class AutomationWorkerProcessor {
  constructor(private readonly automationService: AutomationService) {}

  async processAutomationJob(job: Job<AutomationJobData>) {
    const { executionId, nodeId } = job.data;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await this.automationService.processStep(executionId, nodeId, baseUrl);
  }
}

export function createAutomationWorker(processor: AutomationWorkerProcessor) {
  const queuePrefix = process.env.REDIS_QUEUE_PREFIX || "senlo";
  return new Worker(
    AUTOMATION_QUEUE_NAME,
    async (job: Job<AutomationJobData>) => {
      await processor.processAutomationJob(job);
    },
    {
      connection: redis as any,
      prefix: queuePrefix,
    },
  );
}
