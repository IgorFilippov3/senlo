import { Queue } from "bullmq";
import { redis } from "../redis";
import type { EmailJobData, CampaignJobData } from "./types";

export const EMAIL_QUEUE_NAME = "email-queue";
export const CAMPAIGN_QUEUE_NAME = "campaign-queue";

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redis as any, // Cast to any to resolve version mismatch between BullMQ and ioredis
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const campaignQueue = new Queue<CampaignJobData>(CAMPAIGN_QUEUE_NAME, {
  connection: redis as any, // Cast to any to resolve version mismatch between BullMQ and ioredis
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  },
});
