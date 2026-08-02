// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eq, sql, desc, and, inArray } from "drizzle-orm";
import {
  campaignEvents,
  triggeredSendLogs,
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
  private async getProjectIds(
    userId: string,
    projectId?: number,
  ): Promise<number[]> {
    if (projectId) {
      // Validate that the project belongs to the user
      const [project] = await this.db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
      return project ? [project.id] : [];
    }

    const userProjects = await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId));
    return userProjects.map((p) => p.id);
  }

  async getGlobalStats(
    userId: string,
    projectId?: number,
  ): Promise<DashboardStats> {
    const projectIds = await this.getProjectIds(userId, projectId);

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

    const [stats] = await this.db
      .select({
        totalSent: sql<number>`count(*) filter (where ${campaignEvents.type} = 'SENT')`,
        delivered: sql<number>`count(*) filter (where ${campaignEvents.type} = 'DELIVERED')`,
        bounced: sql<number>`count(*) filter (where ${campaignEvents.type} = 'BOUNCE')`,
        opened: sql<number>`count(*) filter (where ${campaignEvents.type} = 'OPEN')`,
        clicked: sql<number>`count(*) filter (where ${campaignEvents.type} = 'CLICK')`,
        savedSends: sql<number>`count(*) filter (where ${campaignEvents.type} = 'FAILED' AND ${campaignEvents.metadata}->>'error' LIKE 'Recipient is suppressed%')`,
      })
      .from(campaignEvents)
      .innerJoin(campaigns, eq(campaignEvents.campaignId, campaigns.id))
      .where(inArray(campaigns.projectId, projectIds));

    const [triggeredStats] = await this.db
      .select({
        totalSent: sql<number>`count(*) filter (where ${triggeredSendLogs.status} in ('SUCCESS', 'DELIVERED', 'BOUNCED', 'COMPLAINED'))`,
        delivered: sql<number>`count(*) filter (where ${triggeredSendLogs.status} = 'DELIVERED')`,
        bounced: sql<number>`count(*) filter (where ${triggeredSendLogs.status} = 'BOUNCED')`,
        savedSends: sql<number>`count(*) filter (where ${triggeredSendLogs.status} = 'FAILED' AND ${triggeredSendLogs.error} LIKE 'Recipient is suppressed%')`,
      })
      .from(triggeredSendLogs)
      .innerJoin(campaigns, eq(triggeredSendLogs.campaignId, campaigns.id))
      .where(inArray(campaigns.projectId, projectIds));

    return {
      totalSent:
        Number(stats?.totalSent || 0) + Number(triggeredStats?.totalSent || 0),
      delivered:
        Number(stats?.delivered || 0) + Number(triggeredStats?.delivered || 0),
      bounced:
        Number(stats?.bounced || 0) + Number(triggeredStats?.bounced || 0),
      opened: Number(stats?.opened || 0),
      clicked: Number(stats?.clicked || 0),
      savedSends:
        Number(stats?.savedSends || 0) +
        Number(triggeredStats?.savedSends || 0),
    };
  }

  async getActivityStats(
    userId: string,
    days: number,
    projectId?: number,
  ): Promise<DashboardActivity[]> {
    const projectIds = await this.getProjectIds(userId, projectId);

    if (projectIds.length === 0) {
      return [];
    }

    const query = sql`
      WITH intervals AS (
        SELECT generate_series(
          date_trunc('day', now() - interval '${sql.raw(days.toString())} days'),
          date_trunc('day', now()),
          interval '1 day'
        ) AS bucket
      ),
      event_stats AS (
        SELECT
          date_trunc('day', occurred_at) AS bucket,
          count(*) FILTER (WHERE ${campaignEvents.type} IN ('SENT', 'DELIVERED')) as success,
          count(*) FILTER (WHERE ${campaignEvents.type} = 'FAILED' AND ${campaignEvents.metadata}->>'error' LIKE 'Recipient is suppressed%') as suppressed
        FROM ${campaignEvents}
        JOIN ${campaigns} ON ${campaignEvents.campaignId} = ${campaigns.id}
        WHERE ${campaigns.projectId} IN (${sql.raw(projectIds.join(","))})
          AND occurred_at >= now() - interval '${sql.raw(days.toString())} days'
        GROUP BY 1
      ),
      triggered_stats AS (
        SELECT
          date_trunc('day', ${triggeredSendLogs.sentAt}) AS bucket,
          count(*) FILTER (WHERE ${triggeredSendLogs.status} IN ('SUCCESS', 'DELIVERED')) as success,
          count(*) FILTER (WHERE ${triggeredSendLogs.status} = 'FAILED' AND ${triggeredSendLogs.error} LIKE 'Recipient is suppressed%') as suppressed
        FROM ${triggeredSendLogs}
        JOIN ${campaigns} ON ${triggeredSendLogs.campaignId} = ${campaigns.id}
        WHERE ${campaigns.projectId} IN (${sql.raw(projectIds.join(","))})
          AND ${triggeredSendLogs.sentAt} >= now() - interval '${sql.raw(days.toString())} days'
        GROUP BY 1
      )
      SELECT
        intervals.bucket as timestamp,
        COALESCE(event_stats.success, 0) + COALESCE(triggered_stats.success, 0) as success,
        COALESCE(event_stats.suppressed, 0) + COALESCE(triggered_stats.suppressed, 0) as suppressed
      FROM intervals
      LEFT JOIN event_stats ON intervals.bucket = event_stats.bucket
      LEFT JOIN triggered_stats ON intervals.bucket = triggered_stats.bucket
      ORDER BY intervals.bucket ASC
    `;

    const result = await this.db.execute(query);

    return (result.rows as any[]).map((r: any) => ({
      timestamp: new Date(r.timestamp).toISOString(),
      success: Number(r.success),
      suppressed: Number(r.suppressed),
    }));
  }

  async getRecentEvents(
    userId: string,
    limit: number,
    projectId?: number,
  ): Promise<DashboardEvent[]> {
    const projectIds = await this.getProjectIds(userId, projectId);

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
