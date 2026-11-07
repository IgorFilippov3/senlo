// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ServiceHooks } from "../hooks";
import { consoleLogger, type Logger } from "../logger";
import type { ILogRetentionRepository } from "../ports";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows per delete statement: small enough to keep each one short, large enough to finish. */
export const LOG_RETENTION_BATCH_SIZE = 5_000;

/**
 * A PENDING send younger than this is kept whatever the retention: the
 * queue may still be retrying it, and its log row is where the worker will
 * write the outcome.
 */
export const PENDING_GRACE_DAYS = 3;

export interface LogRetentionResult {
  /** `not_backfilled`: the statistics were not backfilled yet, so no log row or event was deleted. */
  status: "done" | "not_backfilled";
  sendLogs: number;
  events: number;
  dailyUniques: number;
  /** Projects with a retention that were cleaned. */
  projects: number;
}

/**
 * The daily cleanup: deletes delivery log rows and raw campaign events older
 * than each project's retention (`RetentionPolicy`), in batches. A project
 * whose retention is `null` (the self-hosted default) is not touched.
 * Statistics stay: they are daily counters, written when the rows were.
 *
 * Nothing is deleted until the statistics backfill has run: the rows it
 * would count are the only copy of the history before the counters existed.
 * The record of today's unique openers is pruned either way: it is not
 * history, only what makes today's unique count exact.
 */
export class LogRetentionService {
  constructor(
    private readonly repo: ILogRetentionRepository,
    private readonly hooks: ServiceHooks,
    private readonly logger: Logger = consoleLogger,
    private readonly options: { batchSize?: number; now?: () => Date } = {},
  ) {}

  async run(): Promise<LogRetentionResult> {
    const now = (this.options.now ?? (() => new Date()))();
    const limit = this.options.batchSize ?? LOG_RETENTION_BATCH_SIZE;

    // Today and yesterday stay (the app and the database may disagree
    // about midnight by a little).
    const beforeDay = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10);
    const dailyUniques = await this.drain(() => this.repo.deleteDailyUniques({ beforeDay, limit }), limit);

    if (!(await this.repo.isStatsBackfilled())) {
      this.logger.warn(
        "Log retention skipped: the daily statistics are not backfilled yet. Run `pnpm db:backfill-stats`.",
      );
      return { status: "not_backfilled", sendLogs: 0, events: 0, dailyUniques, projects: 0 };
    }

    const keepPendingSince = new Date(now.getTime() - PENDING_GRACE_DAYS * DAY_MS);
    let sendLogs = 0;
    let events = 0;
    let projects = 0;

    for (const projectId of await this.repo.listProjectIds()) {
      const days = await this.hooks.logRetentionDays(projectId);
      if (days === null) continue;
      if (!Number.isInteger(days) || days < 1) {
        this.logger.error("Log retention skipped for a project: the policy returned an invalid number of days", {
          projectId,
          days,
        });
        continue;
      }

      const before = new Date(now.getTime() - days * DAY_MS);
      const logs = await this.drain(
        () => this.repo.deleteSendLogs(projectId, { before, keepPendingSince, limit }),
        limit,
      );
      const raw = await this.drain(() => this.repo.deleteEvents(projectId, { before, limit }), limit);
      projects += 1;
      sendLogs += logs;
      events += raw;
      if (logs > 0 || raw > 0) {
        this.logger.info("Log retention: rows deleted", { projectId, retentionDays: days, sendLogs: logs, events: raw });
      }
    }

    this.logger.info("Log retention done", { projects, sendLogs, events, dailyUniques });
    return { status: "done", sendLogs, events, dailyUniques, projects };
  }

  /** Repeats a batch delete until a batch comes back short; the total removed. */
  private async drain(batch: () => Promise<number>, limit: number): Promise<number> {
    let total = 0;
    for (;;) {
      const deleted = await batch();
      total += deleted;
      if (deleted < limit) return total;
    }
  }
}
