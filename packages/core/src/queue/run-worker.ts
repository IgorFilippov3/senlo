// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AccessPolicy } from "../access";
import { mailSettings, type SenloConfig } from "../config";
import type { Repositories } from "../composition";
import type { ResolveBaseUrl } from "../base-url";
import type { AuditLog, QuotaPolicy, UsageMeter } from "../hooks";
import { consoleLogger, type Logger } from "../logger";
import { createRedisConnection } from "../redis";
import { startWorkers, type RunningWorkers } from "./start-workers";

export interface RunSenloWorkerOptions {
  /** The checked config (`loadSenloConfig`): Redis URL, queue prefix, mail settings. */
  config: SenloConfig;
  /**
   * The host's repositories. Built by the host (`createRepositories` from
   * `@senlo/db`): `@senlo/db` depends on core, so core cannot build them.
   */
  repositories: Repositories;
  logger?: Logger;
  access?: AccessPolicy;
  usage?: UsageMeter;
  quota?: QuotaPolicy;
  audit?: AuditLog;
  resolveBaseUrl?: ResolveBaseUrl;
}

/** Signals that stop the worker gracefully: SIGTERM from Docker / systemd, SIGINT from Ctrl+C. */
const STOP_SIGNALS = ["SIGTERM", "SIGINT"] as const;

/**
 * A host's whole worker process after its config check: connects Redis,
 * starts the email and automation workers with the host's ports, and on
 * SIGTERM / SIGINT stops taking jobs, waits for the running ones, closes
 * Redis and exits. A second signal while stopping is ignored.
 */
export function runSenloWorker({
  config,
  repositories,
  logger = consoleLogger,
  ...ports
}: RunSenloWorkerOptions): RunningWorkers {
  const redis = createRedisConnection(config.redisUrl, logger);
  const workers = startWorkers({
    repositories,
    connection: { connection: redis, prefix: config.queuePrefix },
    settings: mailSettings(config),
    logger,
    ...ports,
  });

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info("Shutting down workers", { signal });
    try {
      await workers.close();
      await redis.quit();
      process.exit(0);
    } catch (error) {
      logger.error("Worker shutdown failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      process.exit(1);
    }
  };
  for (const signal of STOP_SIGNALS) process.once(signal, () => void stop(signal));

  return workers;
}
