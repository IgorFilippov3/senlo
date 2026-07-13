import { Worker, Job } from "bullmq";
import { redis } from "../redis";
import type { EmailJobData, CampaignJobData } from "./types";
import {
  ICampaignRepository,
  IEmailProviderRepository,
  ITriggeredSendLogRepository,
  ISuppressionRepository,
} from "../ports";
import { MailerFactory } from "../services/mail";

export class EmailWorkerProcessor {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly providerRepo: IEmailProviderRepository,
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

    await this.campaignRepo.update(campaignId, { status: "SENDING" });
  }
}

export function createEmailWorker(processor: EmailWorkerProcessor) {
  return new Worker(
    "email-queue",
    async (job: Job<EmailJobData>) => {
      await processor.processEmailJob(job);
    },
    {
      connection: redis as any, // Cast to any to resolve version mismatch between BullMQ and ioredis
    },
  );
}
