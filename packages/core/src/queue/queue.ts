// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { EmailJobData, CampaignJobData, AutomationJobData } from "./types";

export const EMAIL_QUEUE_NAME = "email-queue";
export const CAMPAIGN_QUEUE_NAME = "campaign-queue";
export const AUTOMATION_QUEUE_NAME = "automation-queue";

/** Where queues and workers keep their state. */
export interface QueueConnection {
  connection: Redis;
  /** Key prefix, `SenloConfig.queuePrefix`. */
  prefix: string;
}

export interface SenloQueues {
  email: Queue<EmailJobData>;
  campaign: Queue<CampaignJobData>;
  automation: Queue<AutomationJobData>;
}

/**
 * The three queues, created on demand rather than on import, so the prefix
 * and the connection come from the app's config.
 */
export function createQueues({ connection, prefix }: QueueConnection): SenloQueues {
  // Cast: BullMQ bundles its own ioredis types, which differ from ours.
  const options = { connection: connection as any, prefix };

  return {
    email: new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      ...options,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    campaign: new Queue<CampaignJobData>(CAMPAIGN_QUEUE_NAME, {
      ...options,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    automation: new Queue<AutomationJobData>(AUTOMATION_QUEUE_NAME, {
      ...options,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  };
}
