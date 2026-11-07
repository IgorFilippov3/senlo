// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eq, sql, desc, and, inArray } from "drizzle-orm";
import {
  campaignEvents,
  campaignDailyStats,
  projects,
  campaigns,
  suppressions,
} from "../schema";
import {
  DashboardStats,
  DashboardActivity,
  DashboardEvent,
  IDashboardRepository,
} from "@senlo/core";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

export class DashboardRepository implements IDashboardRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}
  // Every method takes the project ids already scoped by `DashboardService`
  // (one checked project, or the caller's whole scope).
  async getGlobalStats(projectIds: number[]): Promise<DashboardStats> {

    if (projectIds.length === 0) {
      return {
        totalSent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        savedSends: 0,
      };
    }

    // From `campaign_daily_stats`: the whole history, whatever retention has
    // deleted from the send log and the raw events.
    const [stats] = await this.db
      .select({
        totalSent: sql<string>`coalesce(sum(${campaignDailyStats.sent}), 0)`,
        delivered: sql<string>`coalesce(sum(${campaignDailyStats.delivered}), 0)`,
        bounced: sql<string>`coalesce(sum(${campaignDailyStats.bounced}), 0)`,
        opened: sql<string>`coalesce(sum(${campaignDailyStats.opened}), 0)`,
        clicked: sql<string>`coalesce(sum(${campaignDailyStats.clicked}), 0)`,
        savedSends: sql<string>`coalesce(sum(${campaignDailyStats.suppressed}), 0)`,
      })
      .from(campaignDailyStats)
      .where(inArray(campaignDailyStats.projectId, projectIds));

    return {
      totalSent: Number(stats?.totalSent ?? 0),
      delivered: Number(stats?.delivered ?? 0),
      bounced: Number(stats?.bounced ?? 0),
      opened: Number(stats?.opened ?? 0),
      clicked: Number(stats?.clicked ?? 0),
      savedSends: Number(stats?.savedSends ?? 0),
    };
  }

  async getActivityStats(
    projectIds: number[],
    days: number,
  ): Promise<DashboardActivity[]> {

    if (projectIds.length === 0) {
      return [];
    }

    // Every caller value goes in as a bound parameter, never as SQL text.
    const projectIdList = sql.join(
      projectIds.map((id) => sql`${id}`),
      sql`, `,
    );

    // UTC days from `campaign_daily_stats`. "Success" is an email the
    // provider accepted that has not bounced or drawn a complaint: the log
    // statuses SUCCESS and DELIVERED.
    const query = sql`
      WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE 'UTC')::date - ${days}::int,
          (now() AT TIME ZONE 'UTC')::date,
          interval '1 day'
        )::date AS day
      )
      SELECT
        to_char(days.day, 'YYYY-MM-DD') AS day,
        COALESCE(sum(s.sent - s.bounced - s.complained), 0) AS success,
        COALESCE(sum(s.suppressed), 0) AS suppressed
      FROM days
      LEFT JOIN ${campaignDailyStats} s
        ON s.day = days.day
        AND s.project_id IN (${projectIdList})
      GROUP BY days.day
      ORDER BY days.day ASC
    `;

    const result = await this.db.execute(query);

    return (result.rows as any[]).map((r: any) => ({
      timestamp: `${r.day}T00:00:00.000Z`,
      success: Number(r.success),
      suppressed: Number(r.suppressed),
    }));
  }

  async getRecentEvents(
    projectIds: number[],
    limit: number,
  ): Promise<DashboardEvent[]> {

    if (projectIds.length === 0) {
      return [];
    }

    const recentEventsQuery = this.db
      .select({
        id: campaignEvents.id,
        type: campaignEvents.type,
        email: campaignEvents.email,
        occurredAt: campaignEvents.occurredAt,
        campaignName: campaigns.name,
      })
      .from(campaignEvents)
      .innerJoin(campaigns, eq(campaignEvents.campaignId, campaigns.id))
      .where(
        and(
          inArray(campaigns.projectId, projectIds),
          inArray(campaignEvents.type, ["BOUNCE", "SPAM_REPORT", "FAILED"]),
        ),
      )
      .orderBy(desc(campaignEvents.occurredAt))
      .limit(limit);

    const recentSuppressionsQuery = this.db
      .select({
        id: suppressions.id,
        email: suppressions.email,
        reason: suppressions.reason,
        createdAt: suppressions.createdAt,
        projectName: projects.name,
      })
      .from(suppressions)
      .innerJoin(projects, eq(suppressions.projectId, projects.id))
      .where(inArray(suppressions.projectId, projectIds))
      .orderBy(desc(suppressions.createdAt))
      .limit(limit);

    const recentCampaignsQuery = this.db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        status: campaigns.status,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .where(
        and(
          inArray(campaigns.projectId, projectIds),
          inArray(campaigns.status, ["COMPLETED", "SENDING"]),
        ),
      )
      .orderBy(desc(campaigns.updatedAt))
      .limit(limit);

    const [events, suppressions_list, activeCampaigns] = await Promise.all([
      recentEventsQuery,
      recentSuppressionsQuery,
      recentCampaignsQuery,
    ]);

    const dashboardEvents: DashboardEvent[] = [
      ...events.map((e) => ({
        id: `event-${e.id}`,
        type: (e.type === "BOUNCE"
          ? "BOUNCE"
          : e.type === "SPAM_REPORT"
            ? "SPAM"
            : "FAILED") as any,
        title:
          e.type === "BOUNCE"
            ? "Bounce Detected"
            : e.type === "SPAM_REPORT"
              ? "Spam Report"
              : "Send Failed",
        description: `${e.email} in ${e.campaignName}`,
        occurredAt: e.occurredAt,
      })),
      ...suppressions_list.map((s) => ({
        id: `supp-${s.id}`,
        type: "SUPPRESSION_ADDED" as const,
        title: "Email Suppressed",
        description: `${s.email} added in ${s.projectName} (Reason: ${s.reason})`,
        occurredAt: s.createdAt,
      })),
      ...activeCampaigns.map((c) => ({
        id: `camp-${c.id}`,
        type:
          c.status === "COMPLETED" ? "CAMPAIGN_COMPLETED" : "CAMPAIGN_STARTED",
        title:
          c.status === "COMPLETED" ? "Campaign Completed" : "Campaign Started",
        description: `Campaign "${c.name}" is ${c.status.toLowerCase()}`,
        occurredAt: c.updatedAt,
      })),
    ];

    return dashboardEvents
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit);
  }
}
