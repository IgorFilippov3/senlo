// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * @fileoverview Writing `campaign_daily_stats`: the deltas the repositories
 * add in the transaction of the row they count, and the one-off backfill
 * from the delivery log and the raw events.
 *
 * Live writes and the backfill of a campaign exclude each other through an
 * advisory lock on the campaign: writes take it shared (they do not block one
 * another), the backfill exclusive. The backfill recomputes a campaign from
 * its raw rows, so a write that commits before it is counted once by the
 * recount and one that commits after once by its own delta.
 */

import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { campaignDailyStats, campaignDailyUniques, campaigns, systemState } from "./schema";

type Db = NodePgDatabase<typeof schema>;
/** The database or a transaction on it: anything that runs a statement. */
type Executor = Pick<Db, "execute">;

export interface CampaignStatCounters {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  suppressed: number;
  opened: number;
  clicked: number;
  uniqueOpened: number;
  uniqueClicked: number;
}

export type CampaignStatDelta = Partial<CampaignStatCounters>;

const COUNTERS: (keyof CampaignStatCounters)[] = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "failed",
  "suppressed",
  "opened",
  "clicked",
  "uniqueOpened",
  "uniqueClicked",
];

/** What the worker writes as the error of a send refused for a suppressed recipient. */
export const SUPPRESSED_ERROR_PREFIX = "Recipient is suppressed";

/** `system_state` key the backfill sets when it is done; retention deletes nothing without it. */
export const CAMPAIGN_STATS_BACKFILL_KEY = "campaign_stats.backfilled";

/** The advisory lock namespace of a campaign's statistics (first key of the pair). */
const STATS_LOCK_NAMESPACE = 0x534c53;

/**
 * What one send log row contributes in its current state. The same rules
 * the statistics queries used on the log before the table existed: sent is
 * every status the provider accepted, delivered/bounced/complained are the
 * final outcome, failed is FAILED, suppressed the part of it refused for a
 * suppressed recipient. PENDING counts nothing.
 */
export function countersForLog(status: string, error: string | null | undefined): CampaignStatDelta {
  switch (status) {
    case "SUCCESS":
      return { sent: 1 };
    case "DELIVERED":
      return { sent: 1, delivered: 1 };
    case "BOUNCED":
      return { sent: 1, bounced: 1 };
    case "COMPLAINED":
      return { sent: 1, complained: 1 };
    case "FAILED":
      return error?.startsWith(SUPPRESSED_ERROR_PREFIX) ? { failed: 1, suppressed: 1 } : { failed: 1 };
    default:
      return {};
  }
}

/** `after - before`, counter by counter; zeros left out. */
export function deltaBetween(before: CampaignStatDelta, after: CampaignStatDelta): CampaignStatDelta {
  const delta: CampaignStatDelta = {};
  for (const key of COUNTERS) {
    const change = (after[key] ?? 0) - (before[key] ?? 0);
    if (change !== 0) delta[key] = change;
  }
  return delta;
}

/** The UTC calendar day of a moment, as `YYYY-MM-DD`. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Takes the campaign's statistics lock until the transaction ends. */
export async function lockCampaignStats(
  tx: Executor,
  campaignId: number,
  mode: "shared" | "exclusive",
): Promise<void> {
  await tx.execute(
    mode === "shared"
      ? sql`SELECT pg_advisory_xact_lock_shared(${STATS_LOCK_NAMESPACE}::int, ${campaignId}::int)`
      : sql`SELECT pg_advisory_xact_lock(${STATS_LOCK_NAMESPACE}::int, ${campaignId}::int)`,
  );
}

/**
 * Adds a delta to a campaign's day, creating the row on its first count.
 * Negative values are fine: a log going from DELIVERED to BOUNCED moves one
 * count from delivered to bounced.
 */
export async function addCampaignStats(
  tx: Executor,
  campaignId: number,
  day: string,
  delta: CampaignStatDelta,
): Promise<void> {
  if (!COUNTERS.some((key) => (delta[key] ?? 0) !== 0)) return;
  const v = (key: keyof CampaignStatCounters) => sql`${delta[key] ?? 0}::int`;

  await tx.execute(sql`
    INSERT INTO ${campaignDailyStats} (
      campaign_id, project_id, day,
      sent, delivered, bounced, complained, failed, suppressed,
      opened, clicked, unique_opened, unique_clicked
    )
    SELECT ${campaigns.id}, ${campaigns.projectId}, ${day}::date,
      ${v("sent")}, ${v("delivered")}, ${v("bounced")}, ${v("complained")}, ${v("failed")}, ${v("suppressed")},
      ${v("opened")}, ${v("clicked")}, ${v("uniqueOpened")}, ${v("uniqueClicked")}
    FROM ${campaigns}
    WHERE ${campaigns.id} = ${campaignId}
    ON CONFLICT (campaign_id, day) DO UPDATE SET
      sent = ${campaignDailyStats}.sent + excluded.sent,
      delivered = ${campaignDailyStats}.delivered + excluded.delivered,
      bounced = ${campaignDailyStats}.bounced + excluded.bounced,
      complained = ${campaignDailyStats}.complained + excluded.complained,
      failed = ${campaignDailyStats}.failed + excluded.failed,
      suppressed = ${campaignDailyStats}.suppressed + excluded.suppressed,
      opened = ${campaignDailyStats}.opened + excluded.opened,
      clicked = ${campaignDailyStats}.clicked + excluded.clicked,
      unique_opened = ${campaignDailyStats}.unique_opened + excluded.unique_opened,
      unique_clicked = ${campaignDailyStats}.unique_clicked + excluded.unique_clicked
  `);
}

/** Records that `email` opened or clicked the campaign on `day`; true the first time that day. */
export async function markDailyUnique(
  tx: Executor,
  campaignId: number,
  day: string,
  kind: "OPEN" | "CLICK",
  email: string,
): Promise<boolean> {
  const result = await tx.execute(sql`
    INSERT INTO ${campaignDailyUniques} (campaign_id, day, kind, email)
    VALUES (${campaignId}, ${day}::date, ${kind}, ${email})
    ON CONFLICT DO NOTHING
    RETURNING 1
  `);
  return result.rows.length > 0;
}

/** Whether `pnpm db:backfill-stats` has run on this database. */
export async function isCampaignStatsBackfilled(db: Db): Promise<boolean> {
  const [row] = await db
    .select({ key: systemState.key })
    .from(systemState)
    .where(eq(systemState.key, CAMPAIGN_STATS_BACKFILL_KEY));
  return Boolean(row);
}

export type BackfillResult =
  | { status: "done"; campaigns: number }
  | { status: "already_done" };

/**
 * Fills `campaign_daily_stats` (and today's and yesterday's uniques) from the
 * delivery log and the raw events, campaign by campaign, then sets the
 * marker retention waits for.
 *
 * Each campaign is recomputed from scratch, so a run interrupted halfway is
 * simply run again. Once the marker is set it refuses: retention may have
 * deleted raw rows since, and a recount would then lower the statistics.
 *
 * The sources match what the statistics queries read before the table: the
 * delivery log for every campaign (triggers and automations), the raw SENT,
 * DELIVERED, BOUNCE, SPAM_REPORT and suppressed FAILED events for legacy
 * STANDARD campaigns (which have no log), OPEN and CLICK events for all.
 */
export async function backfillCampaignStats(
  db: Db,
  options: { log?: (message: string) => void } = {},
): Promise<BackfillResult> {
  const log = options.log ?? (() => {});
  if (await isCampaignStatsBackfilled(db)) return { status: "already_done" };

  const rows = await db
    .select({ id: campaigns.id, projectId: campaigns.projectId, type: campaigns.type })
    .from(campaigns)
    .orderBy(campaigns.id);

  let done = 0;
  for (const campaign of rows) {
    await db.transaction(async (tx) => {
      await lockCampaignStats(tx, campaign.id, "exclusive");
      await recountCampaign(tx, campaign);
    });
    done += 1;
    if (done % 100 === 0) log(`campaign_daily_stats: ${done}/${rows.length} campaigns`);
  }

  await db
    .insert(systemState)
    .values({
      key: CAMPAIGN_STATS_BACKFILL_KEY,
      value: { at: new Date().toISOString(), campaigns: rows.length },
    })
    .onConflictDoUpdate({
      target: systemState.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });

  log(`campaign_daily_stats: ${rows.length} campaigns backfilled`);
  return { status: "done", campaigns: rows.length };
}

async function recountCampaign(
  tx: Executor,
  campaign: { id: number; projectId: number; type: "STANDARD" | "TRIGGERED" },
): Promise<void> {
  const id = campaign.id;
  const zeros = sql`0::bigint, 0::bigint, 0::bigint, 0::bigint`;

  const legacyEvents =
    campaign.type === "STANDARD"
      ? sql`
        UNION ALL
        SELECT (occurred_at AT TIME ZONE 'UTC')::date,
          count(*) FILTER (WHERE type = 'SENT'),
          count(*) FILTER (WHERE type = 'DELIVERED'),
          count(*) FILTER (WHERE type = 'BOUNCE'),
          count(*) FILTER (WHERE type = 'SPAM_REPORT'),
          0::bigint,
          count(*) FILTER (WHERE type = 'FAILED' AND metadata->>'error' LIKE ${SUPPRESSED_ERROR_PREFIX + "%"}),
          ${zeros}
        FROM campaign_events
        WHERE campaign_id = ${id} AND type IN ('SENT', 'DELIVERED', 'BOUNCE', 'SPAM_REPORT', 'FAILED')
        GROUP BY 1`
      : sql``;

  await tx.execute(sql`DELETE FROM ${campaignDailyStats} WHERE campaign_id = ${id}`);
  await tx.execute(sql`DELETE FROM ${campaignDailyUniques} WHERE campaign_id = ${id}`);

  await tx.execute(sql`
    INSERT INTO ${campaignDailyStats} (
      campaign_id, project_id, day,
      sent, delivered, bounced, complained, failed, suppressed,
      opened, clicked, unique_opened, unique_clicked
    )
    SELECT ${id}, ${campaign.projectId}, day,
      sum(sent), sum(delivered), sum(bounced), sum(complained), sum(failed), sum(suppressed),
      sum(opened), sum(clicked), sum(unique_opened), sum(unique_clicked)
    FROM (
      SELECT (sent_at AT TIME ZONE 'UTC')::date AS day,
        count(*) FILTER (WHERE status IN ('SUCCESS', 'DELIVERED', 'BOUNCED', 'COMPLAINED')) AS sent,
        count(*) FILTER (WHERE status = 'DELIVERED') AS delivered,
        count(*) FILTER (WHERE status = 'BOUNCED') AS bounced,
        count(*) FILTER (WHERE status = 'COMPLAINED') AS complained,
        count(*) FILTER (WHERE status = 'FAILED') AS failed,
        count(*) FILTER (WHERE status = 'FAILED' AND error LIKE ${SUPPRESSED_ERROR_PREFIX + "%"}) AS suppressed,
        0::bigint AS opened, 0::bigint AS clicked, 0::bigint AS unique_opened, 0::bigint AS unique_clicked
      FROM triggered_send_logs
      WHERE campaign_id = ${id}
      GROUP BY 1
      UNION ALL
      SELECT (occurred_at AT TIME ZONE 'UTC')::date,
        0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint, 0::bigint,
        count(*) FILTER (WHERE type = 'OPEN'),
        count(*) FILTER (WHERE type = 'CLICK'),
        count(DISTINCT email) FILTER (WHERE type = 'OPEN'),
        count(DISTINCT email) FILTER (WHERE type = 'CLICK')
      FROM campaign_events
      WHERE campaign_id = ${id} AND type IN ('OPEN', 'CLICK')
      GROUP BY 1
      ${legacyEvents}
    ) AS counted
    GROUP BY day
  `);

  // Live opens and clicks from now on must know who already counted as
  // unique today (and yesterday, should the clocks of the app and the
  // database disagree about midnight).
  await tx.execute(sql`
    INSERT INTO ${campaignDailyUniques} (campaign_id, day, kind, email)
    SELECT DISTINCT campaign_id, (occurred_at AT TIME ZONE 'UTC')::date, type::text, email
    FROM campaign_events
    WHERE campaign_id = ${id}
      AND type IN ('OPEN', 'CLICK')
      AND (occurred_at AT TIME ZONE 'UTC')::date >= (now() AT TIME ZONE 'UTC')::date - 1
    ON CONFLICT DO NOTHING
  `);
}
