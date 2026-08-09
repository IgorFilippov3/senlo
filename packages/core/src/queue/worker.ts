import { Worker, Job, Queue } from "bullmq";
import { redis } from "../redis";
import type { EmailJobData, CampaignJobData } from "./types";
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
import { encodeUnsubscribeToken } from "../unsubscribe-token";
import { renderEmailDesign } from "../renderer/renderEmailDesign";
import { wrapLinksWithTracking } from "../tracking";
import { EmailDesignDocument } from "../emailDesign";

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

  async processEmailJob(job: Job<EmailJobData>) {
    const {
      projectId,
      campaignId,
      contactId,
      logId,
      email,
      from,
      subject,
      html,
      providerId,
      replyTo,
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

      const mailer = MailerFactory.create(provider);

      const result = await mailer.send({
        from,
        to: email,
        subject,
        html,
        replyTo,
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
      console.warn(`[Worker] Campaign ${campaignId} has no recipients, marking as completed`);
      await this.campaignRepo.update(campaignId, { status: "COMPLETED" });
      return;
    }

    console.log(`[Worker] Starting campaign ${campaignId} send to ${contacts.length} recipients`);

    await this.campaignRepo.update(campaignId, {
      status: "SENDING",
      sentAt: new Date(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Queue jobs in chunks to avoid memory issues and BullMQ limits
    const CHUNK_SIZE = 100;
    for (let i = 0; i < contacts.length; i += CHUNK_SIZE) {
      const chunk = contacts.slice(i, i + CHUNK_SIZE);
      
      await Promise.all(
        chunk.map(async (contact) => {
          const emailEncoded = encodeURIComponent(contact.email);
          const unsubscribeToken = encodeUnsubscribeToken({
            contactId: contact.id,
            campaignId: campaign.id,
          });
          const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${unsubscribeToken}`;

          const openTrackingUrl = `${baseUrl}/api/track/open/${campaign.id}/${emailEncoded}`;
          const trackingPixel = `<img src="${openTrackingUrl}" width="1" height="1" style="display:none !important;" alt="" />`;

          const clickTrackingBaseUrl = `${baseUrl}/api/track/click/${campaign.id}/${emailEncoded}`;

          let personalizedHtml = template.designJson
            ? renderEmailDesign(template.designJson as EmailDesignDocument, {
                baseUrl,
                data: {
                  contact,
                  unsubscribeUrl,
                },
              })
            : template.html;

          personalizedHtml = wrapLinksWithTracking(
            personalizedHtml,
            clickTrackingBaseUrl,
          );
          personalizedHtml += trackingPixel;

          const fromAddress = campaign.fromName
            ? `${campaign.fromName} <${campaign.fromEmail || "hello@senlo.io"}>`
            : campaign.fromEmail || "hello@senlo.io";

          return this.emailQueue.add(`campaign-${campaign.id}-${contact.id}-${Date.now()}`, {
            projectId: project.id,
            campaignId: campaign.id,
            contactId: contact.id,
            email: contact.email,
            from: fromAddress,
            subject: campaign.subject || template.subject,
            html: personalizedHtml,
            providerId: project.providerId!,
          });
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
