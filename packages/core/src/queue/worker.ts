import { Worker, Job } from "bullmq";
import { redis } from "../redis";
import type { EmailJobData, CampaignJobData } from "./types";
import { ICampaignRepository, IEmailProviderRepository } from "../ports";
import { MailerFactory } from "../services/mail";

export class EmailWorkerProcessor {
  constructor(
    private readonly campaignRepo: ICampaignRepository,
    private readonly providerRepo: IEmailProviderRepository
  ) {}

  async processEmailJob(job: Job<EmailJobData>) {
    const { campaignId, contactId, email, from, subject, html, providerId } =
      job.data;

    try {
      const provider = await this.providerRepo.findById(providerId);
      if (!provider) throw new Error(`Provider ${providerId} not found`);

      const mailer = MailerFactory.create(provider);

      const result = await mailer.send({
        from,
        to: email,
        subject,
        html,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send email");
      }

      if (campaignId !== 0) {
        await this.campaignRepo.logEvent({
          campaignId,
          contactId,
          email,
          type: "SENT",
          metadata: { provider: provider.type, messageId: result.messageId },
        });

        await this.campaignRepo.logEvent({
          campaignId,
          contactId,
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
          contactId,
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
    }
  );
}
