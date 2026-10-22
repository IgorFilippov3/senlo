// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Worker } from "bullmq";
import type { AccessPolicy } from "../access";
import type { MailSettings } from "../config";
import { createServices, type Repositories } from "../composition";
import { consoleLogger, type Logger } from "../logger";
import { createQueues, type QueueConnection } from "./queue";
import {
  AutomationWorkerProcessor,
  EmailWorkerProcessor,
  createAutomationWorker,
  createCampaignWorker,
  createEmailWorker,
} from "./worker";

export interface RunningWorkers {
  /** Stops taking jobs and waits for the running ones. */
  close(): Promise<void>;
}

/**
 * Starts the email, campaign and automation workers. Everything an app's
 * worker process used to assemble by hand - queues, services, processors,
 * logging - so a second app runs the same workers with one call.
 */
export function startWorkers({
  repositories,
  connection,
  settings,
  logger = consoleLogger,
  access,
}: {
  repositories: Repositories;
  connection: QueueConnection;
  settings: MailSettings;
  logger?: Logger;
  /** Passed to `createServices`; see its `access`. */
  access?: AccessPolicy;
}): RunningWorkers {
  const queues = createQueues(connection);
  const services = createServices({ repositories, queues, settings, logger, access });

  const emailProcessor = new EmailWorkerProcessor(
    settings,
    repositories.campaigns,
    repositories.providers,
    repositories.templates,
    repositories.projects,
    repositories.lists,
    queues.email,
    repositories.sendLogs,
    repositories.suppressions,
    logger,
  );
  const automationProcessor = new AutomationWorkerProcessor(
    services.automation,
    settings,
  );

  const workers: Array<[string, Worker]> = [
    ["email", createEmailWorker(emailProcessor, connection)],
    ["campaign", createCampaignWorker(emailProcessor, connection)],
    ["automation", createAutomationWorker(automationProcessor, connection)],
  ];

  for (const [name, worker] of workers) {
    worker.on("completed", (job) =>
      logger.info(`[${name}] job completed`, { jobId: job.id }),
    );
    worker.on("failed", (job, error) =>
      logger.error(`[${name}] job failed`, {
        jobId: job?.id,
        error: error.message,
      }),
    );
  }
  logger.info("Workers started", { workers: workers.map(([name]) => name) });

  return {
    async close() {
      await Promise.all(workers.map(([, worker]) => worker.close()));
      await Promise.all(Object.values(queues).map((queue) => queue.close()));
    },
  };
}
