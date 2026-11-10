// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Queue, Worker, type Job } from "bullmq";
import type { LogRetentionService } from "../services/logRetentionService";
import type { AutomationService } from "../services/automationService";
import type { QueueConnection } from "./queue";

/**
 * Housekeeping that runs on a schedule rather than per message: log
 * retention once a day, the automation sweeper every five minutes.
 */
export const MAINTENANCE_QUEUE_NAME = "maintenance-queue";

export const LOG_RETENTION_JOB = "log-retention";

/** Every day at 03:17 UTC: at night for Europe, off the round hour other schedules use. */
export const LOG_RETENTION_SCHEDULE = { pattern: "17 3 * * *", tz: "UTC" };

export const AUTOMATION_SWEEP_JOB = "automation-sweep";

/** Every five minutes: a run whose job was lost waits at most this plus the grace. */
export const AUTOMATION_SWEEP_SCHEDULE = { every: 5 * 60 * 1000 };

export function createMaintenanceQueue({ connection, prefix }: QueueConnection): Queue {
  // Cast: BullMQ bundles its own ioredis types, which differ from ours.
  return new Queue(MAINTENANCE_QUEUE_NAME, {
    connection: connection as any,
    prefix,
    defaultJobOptions: {
      // A failed run is not retried: the next day's run deletes what it left.
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 20,
    },
  });
}

/**
 * Registers the daily retention run. An upsert: every worker start (and
 * every worker of a scaled-out install) writes the same scheduler, and
 * BullMQ creates one job per tick, so the cleanup runs once a day whatever
 * the number of workers.
 */
export async function scheduleLogRetention(queue: Queue): Promise<void> {
  await queue.upsertJobScheduler(LOG_RETENTION_JOB, LOG_RETENTION_SCHEDULE, {
    name: LOG_RETENTION_JOB,
  });
}

/** Registers the sweeper; an upsert, like the retention scheduler. */
export async function scheduleAutomationSweep(queue: Queue): Promise<void> {
  await queue.upsertJobScheduler(AUTOMATION_SWEEP_JOB, AUTOMATION_SWEEP_SCHEDULE, {
    name: AUTOMATION_SWEEP_JOB,
  });
}

export function createMaintenanceWorker(
  jobs: { retention?: LogRetentionService; automation: Pick<AutomationService, "recoverDueRuns"> },
  { connection, prefix }: QueueConnection,
): Worker {
  return new Worker(
    MAINTENANCE_QUEUE_NAME,
    async (job: Job) => {
      if (job.name === LOG_RETENTION_JOB) return jobs.retention?.run();
      if (job.name === AUTOMATION_SWEEP_JOB) return jobs.automation.recoverDueRuns();
      return undefined;
    },
    // One job at a time per worker; BullMQ already gives each job to one worker.
    { connection: connection as any, prefix, concurrency: 1 },
  );
}
