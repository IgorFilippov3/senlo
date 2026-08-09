import { eq, desc, sql, and } from "drizzle-orm";
import { triggeredSendLogs } from "../schema";
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
   * @param data - Log data including campaignId, email, status, and optional error/data
   * @returns The created log entry
   */
  async create(
    data: Omit<TriggeredSendLog, "id" | "sentAt">,
  ): Promise<TriggeredSendLog> {
    const [row] = await this.db
      .insert(triggeredSendLogs)
      .values({
        campaignId: data.campaignId,
        email: data.email,
        status: data.status,
        error: data.error,
        data: data.data,
        sentAt: new Date(),
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Update a log entry by ID.
   */
  async update(
    id: number,
    data: Partial<Omit<TriggeredSendLog, "id" | "sentAt">>,
  ): Promise<TriggeredSendLog | null> {
    const [row] = await this.db
      .update(triggeredSendLogs)
      .set({
        ...data,
      })
      .where(eq(triggeredSendLogs.id, id))
      .returning();

    return row ? this.mapToEntity(row) : null;
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
   * Get send statistics for a campaign.
   */
  async getStatsByCampaign(campaignId: number): Promise<{
    sent: number;
    delivered: number;
    errors: number;
  }> {
    const [stats] = await this.db
      .select({
        sent: sql<number>`count(*) filter (where status in ('SUCCESS', 'DELIVERED', 'BOUNCED', 'COMPLAINED'))`,
        delivered: sql<number>`count(*) filter (where status = 'DELIVERED')`,
        errors: sql<number>`count(*) filter (where status = 'FAILED')`,
      })
      .from(triggeredSendLogs)
      .where(eq(triggeredSendLogs.campaignId, campaignId));

    // Also count events from campaign_events as a fallback/complement
    const [eventStats] = await this.db
      .select({
        delivered: sql<number>`count(*) filter (where type = 'DELIVERED')`,
      })
      .from(sql`campaign_events`)
      .where(eq(sql`campaign_id`, campaignId));

    return {
      sent: Number(stats?.sent || 0),
      delivered: Math.max(
        Number(stats?.delivered || 0),
        Number(eventStats?.delivered || 0),
      ),
      errors: Number(stats?.errors || 0),
    };
  }
}
