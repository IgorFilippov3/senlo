// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { ILogRetentionRepository } from "@senlo/core";
import { isCampaignStatsBackfilled } from "../campaign-stats";
import * as schema from "../schema";
import { campaignDailyUniques, campaignEvents, campaigns, projects, triggeredSendLogs } from "../schema";

/**
 * The deletes behind the daily retention job. Each statement removes at
 * most `limit` rows, picked through an index (`(campaign_id, sent_at)`,
 * `(campaign_id, occurred_at)`), and returns the count, so the job loops
 * in short transactions. Deleting raw rows never touches
 * `campaign_daily_stats`: the counters were written with the rows.
 */
export class LogRetentionRepository implements ILogRetentionRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  isStatsBackfilled(): Promise<boolean> {
    return isCampaignStatsBackfilled(this.db);
  }

  async listProjectIds(): Promise<number[]> {
    const rows = await this.db.select({ id: projects.id }).from(projects).orderBy(projects.id);
    return rows.map((r) => r.id);
  }

  async deleteSendLogs(
    projectId: number,
    { before, keepPendingSince, limit }: { before: Date; keepPendingSince: Date; limit: number },
  ): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM ${triggeredSendLogs}
      WHERE id IN (
        SELECT l.id
        FROM ${triggeredSendLogs} l
        WHERE l.campaign_id IN (SELECT ${campaigns.id} FROM ${campaigns} WHERE ${campaigns.projectId} = ${projectId})
          AND l.sent_at < ${before.toISOString()}::timestamptz
          AND NOT (l.status = 'PENDING' AND l.sent_at >= ${keepPendingSince.toISOString()}::timestamptz)
        LIMIT ${limit}
      )
    `);
    return affected(result);
  }

  async deleteEvents(
    projectId: number,
    { before, limit }: { before: Date; limit: number },
  ): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM ${campaignEvents}
      WHERE id IN (
        SELECT e.id
        FROM ${campaignEvents} e
        WHERE e.campaign_id IN (SELECT ${campaigns.id} FROM ${campaigns} WHERE ${campaigns.projectId} = ${projectId})
          AND e.occurred_at < ${before.toISOString()}::timestamptz
        LIMIT ${limit}
      )
    `);
    return affected(result);
  }

  async deleteDailyUniques({ beforeDay, limit }: { beforeDay: string; limit: number }): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM ${campaignDailyUniques}
      WHERE ctid IN (
        SELECT ctid FROM ${campaignDailyUniques}
        WHERE day < ${beforeDay}::date
        LIMIT ${limit}
      )
    `);
    return affected(result);
  }
}

/** Rows a DELETE removed: `rowCount` from node-postgres, `affectedRows` from PGlite. */
function affected(result: unknown): number {
  const r = result as { rowCount?: number | null; affectedRows?: number };
  return Number(r.rowCount ?? r.affectedRows ?? 0);
}
