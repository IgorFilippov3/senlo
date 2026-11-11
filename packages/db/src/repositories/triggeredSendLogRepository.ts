import { eq, desc, sql, and } from "drizzle-orm";
import { campaignDailyStats, campaignEvents, triggeredSendLogs } from "../schema";
import {
  addCampaignStats,
  countersForLog,
  deltaBetween,
  lockCampaignStats,
  utcDay,
} from "../campaign-stats";
import type { TriggeredSendLog } from "@senlo/core";
import { BaseRepository } from "./baseRepository";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

/**
 * Repository for logging triggered (API-initiated) email sends.
 * Extends BaseRepository for common operations (findById, delete).
 */
export class TriggeredSendLogRepository extends BaseRepository<
  typeof triggeredSendLogs,
  typeof triggeredSendLogs.$inferSelect,
  TriggeredSendLog
> {
  protected table = triggeredSendLogs;

  constructor(db: NodePgDatabase<typeof schema>) {
    super(db);
  }


  /**
   * Map a database row to a TriggeredSendLog entity.
   * @param row - The raw database row
   * @returns The mapped TriggeredSendLog
   */
  protected mapToEntity(
    row: typeof triggeredSendLogs.$inferSelect,
  ): TriggeredSendLog {
    return {
      id: row.id,
      campaignId: row.campaignId,
      email: row.email,
      status: row.status as any,
      providerMessageId: row.providerMessageId,
      error: row.error,
      data: row.data as Record<string, any> | null,
      workflowExecutionId: row.workflowExecutionId,
      sentAt: row.sentAt,
    };
  }

  /**
   * Get all triggered send logs for a campaign, ordered by send time (newest first).
   * @param campaignId - The campaign ID
   * @returns Array of send logs
   */
  async findByCampaign(campaignId: number): Promise<TriggeredSendLog[]> {
    const rows = await this.db
      .select()
      .from(triggeredSendLogs)
      .where(eq(triggeredSendLogs.campaignId, campaignId))
      .orderBy(desc(triggeredSendLogs.sentAt));

    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Log a triggered email send attempt.
   * Counted in `campaign_daily_stats` in the same transaction (a PENDING log
   * counts nothing yet).
   * @param data - Log data including campaignId, email, status, and optional error/data
   * @returns The created log entry
   */
  async create(
    data: Omit<TriggeredSendLog, "id" | "sentAt">,
  ): Promise<TriggeredSendLog> {
    return this.db.transaction(async (tx) => {
      await lockCampaignStats(tx, data.campaignId, "shared");
      const [row] = await tx
        .insert(triggeredSendLogs)
        .values({
          campaignId: data.campaignId,
          email: data.email,
          status: data.status,
          error: data.error,
          data: data.data,
          workflowExecutionId: data.workflowExecutionId ?? null,
          sentAt: new Date(),
        })
        .returning();

      await addCampaignStats(tx, row.campaignId, utcDay(row.sentAt), countersForLog(row.status, row.error));
      return this.mapToEntity(row);
    });
  }

  async createOnce(
    data: Omit<TriggeredSendLog, "id" | "sentAt">,
    dedupeKey: string,
  ): Promise<{ log: TriggeredSendLog; created: boolean }> {
    return this.db.transaction(async (tx) => {
      await lockCampaignStats(tx, data.campaignId, "shared");
      const [row] = await tx
        .insert(triggeredSendLogs)
        .values({
          campaignId: data.campaignId,
          email: data.email,
          status: data.status,
          error: data.error,
          data: data.data,
          workflowExecutionId: data.workflowExecutionId ?? null,
          dedupeKey,
          sentAt: new Date(),
        })
        .onConflictDoNothing({ target: triggeredSendLogs.dedupeKey })
        .returning();
      if (row) {
        await addCampaignStats(tx, row.campaignId, utcDay(row.sentAt), countersForLog(row.status, row.error));
        return { log: this.mapToEntity(row), created: true };
      }
      const [existing] = await tx.select().from(triggeredSendLogs).where(eq(triggeredSendLogs.dedupeKey, dedupeKey));
      return { log: this.mapToEntity(existing), created: false };
    });
  }

  async hasEngagement(logId: number, type: "OPEN" | "CLICK"): Promise<boolean> {
    // Through (campaign_id, type, occurred_at), then the address.
    const result = (await this.db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM ${triggeredSendLogs} l
        JOIN ${campaignEvents} e
          ON e.campaign_id = l.campaign_id
         AND e.type = ${type}
         AND e.occurred_at >= l.sent_at
         AND lower(e.email) = lower(l.email)
        WHERE l.id = ${logId}
      ) AS engaged
    `)) as unknown as { rows: Array<{ engaged: boolean }> };
    return Boolean(result.rows[0]?.engaged);
  }

  async countAutomationSends(projectId: number, email: string, since: Date): Promise<number> {
    // Through (email, sent_at) where workflow_execution_id is set, then the campaign's project.
    const result = (await this.db.execute(sql`
      SELECT count(*)::int AS n
      FROM ${triggeredSendLogs} l
      JOIN ${schema.campaigns} c ON c.id = l.campaign_id
      WHERE l.email = ${email}
        AND l.sent_at >= ${since.toISOString()}
        AND l.workflow_execution_id IS NOT NULL
        AND c.project_id = ${projectId}
    `)) as unknown as { rows: Array<{ n: number }> };
    return Number(result.rows[0]?.n ?? 0);
  }

  async findByDedupeKey(dedupeKey: string): Promise<TriggeredSendLog | null> {
    const [row] = await this.db.select().from(triggeredSendLogs).where(eq(triggeredSendLogs.dedupeKey, dedupeKey));
    return row ? this.mapToEntity(row) : null;
  }

  /**
   * Update a log entry by ID.
   *
   * A status or error change moves the email between counters of
   * `campaign_daily_stats`, on the day it was sent, in the same transaction.
   * The row is locked first, so two webhooks for one email apply one after
   * the other and a repeated one changes nothing.
   */
  async update(
    id: number,
    data: Partial<Omit<TriggeredSendLog, "id" | "sentAt">>,
  ): Promise<TriggeredSendLog | null> {
    return this.db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(triggeredSendLogs)
        .where(eq(triggeredSendLogs.id, id))
        .for("update");
      if (!before) return null;

      await lockCampaignStats(tx, before.campaignId, "shared");
      const [row] = await tx
        .update(triggeredSendLogs)
        .set({
          ...data,
        })
        .where(eq(triggeredSendLogs.id, id))
        .returning();

      await addCampaignStats(
        tx,
        row.campaignId,
        utcDay(before.sentAt),
        deltaBetween(countersForLog(before.status, before.error), countersForLog(row.status, row.error)),
      );
      return this.mapToEntity(row);
    });
  }

  /**
   * Find a log entry by provider message ID.
   */
  async findByProviderMessageId(
    providerMessageId: string,
  ): Promise<TriggeredSendLog | null> {
    const [row] = await this.db
      .select()
      .from(triggeredSendLogs)
      .where(eq(triggeredSendLogs.providerMessageId, providerMessageId));

    return row ? this.mapToEntity(row) : null;
  }

  /**
   * Find the latest log entry for a campaign and email.
   */
  async findLatestByCampaignAndEmail(
    campaignId: number,
    email: string,
  ): Promise<TriggeredSendLog | null> {
    const [row] = await this.db
      .select()
      .from(triggeredSendLogs)
      .where(
        and(
          eq(triggeredSendLogs.campaignId, campaignId),
          eq(triggeredSendLogs.email, email),
        ),
      )
      .orderBy(desc(triggeredSendLogs.sentAt))
      .limit(1);

    return row ? this.mapToEntity(row) : null;
  }

  /**
   * Get send statistics for a campaign, from `campaign_daily_stats`: the
   * whole history, including emails whose log rows retention has deleted.
   */
  async getStatsByCampaign(campaignId: number): Promise<{
    sent: number;
    delivered: number;
    errors: number;
  }> {
    const [stats] = await this.db
      .select({
        sent: sql<string>`coalesce(sum(${campaignDailyStats.sent}), 0)`,
        delivered: sql<string>`coalesce(sum(${campaignDailyStats.delivered}), 0)`,
        errors: sql<string>`coalesce(sum(${campaignDailyStats.failed}), 0)`,
      })
      .from(campaignDailyStats)
      .where(eq(campaignDailyStats.campaignId, campaignId));

    return {
      sent: Number(stats?.sent ?? 0),
      delivered: Number(stats?.delivered ?? 0),
      errors: Number(stats?.errors ?? 0),
    };
  }
}
