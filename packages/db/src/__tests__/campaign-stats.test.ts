// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Database } from "../client";
import * as schema from "../schema";
import { backfillCampaignStats, isCampaignStatsBackfilled } from "../campaign-stats";
import { CampaignRepository } from "../repositories/campaignRepository";
import { DashboardRepository } from "../repositories/dashboardRepository";
import { TriggeredSendLogRepository } from "../repositories/triggeredSendLogRepository";
import { createTestDb, seedCampaign } from "./test-db";

let db: Database;
let close: () => Promise<void>;
let logs: TriggeredSendLogRepository;
let campaigns: CampaignRepository;
let dashboard: DashboardRepository;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  logs = new TriggeredSendLogRepository(db);
  campaigns = new CampaignRepository(db);
  dashboard = new DashboardRepository(db);
});

afterEach(async () => {
  await close();
});

const at = (iso: string) => new Date(iso);

/** History as the code before `campaign_daily_stats` left it: raw rows, no counters. */
async function seedHistory(campaignId: number) {
  await db.insert(schema.triggeredSendLogs).values([
    { campaignId, email: "a@x.io", status: "DELIVERED", sentAt: at("2026-11-01T10:00:00Z") },
    { campaignId, email: "b@x.io", status: "BOUNCED", sentAt: at("2026-11-01T11:00:00Z") },
    { campaignId, email: "c@x.io", status: "SUCCESS", sentAt: at("2026-11-02T23:59:00Z") },
    {
      campaignId,
      email: "d@x.io",
      status: "FAILED",
      error: "Recipient is suppressed (Reason: BOUNCE)",
      sentAt: at("2026-11-03T10:00:00Z"),
    },
    { campaignId, email: "e@x.io", status: "FAILED", error: "Provider said no", sentAt: at("2026-11-03T10:00:00Z") },
    { campaignId, email: "f@x.io", status: "PENDING", sentAt: at("2026-11-03T10:00:00Z") },
    { campaignId, email: "g@x.io", status: "COMPLAINED", sentAt: at("2026-11-04T10:00:00Z") },
  ]);
  await db.insert(schema.campaignEvents).values([
    // SENT/DELIVERED events of a trigger are not counted: its log is.
    { campaignId, email: "a@x.io", type: "SENT", occurredAt: at("2026-11-01T10:00:00Z") },
    { campaignId, email: "a@x.io", type: "DELIVERED", occurredAt: at("2026-11-01T10:01:00Z") },
    { campaignId, email: "a@x.io", type: "OPEN", occurredAt: at("2026-11-01T12:00:00Z") },
    { campaignId, email: "a@x.io", type: "OPEN", occurredAt: at("2026-11-01T13:00:00Z") },
    { campaignId, email: "a@x.io", type: "OPEN", occurredAt: at("2026-11-02T13:00:00Z") },
    { campaignId, email: "c@x.io", type: "CLICK", linkUrl: "https://x.io", occurredAt: at("2026-11-03T13:00:00Z") },
  ]);
}

describe("backfill", () => {
  it("counts the history the way the statistics queries read it from the raw rows", async () => {
    const { projectId, campaignId } = await seedCampaign(db);
    await seedHistory(campaignId);

    expect(await backfillCampaignStats(db)).toEqual({ status: "done", campaigns: 1 });

    expect(await logs.getStatsByCampaign(campaignId)).toEqual({ sent: 4, delivered: 1, errors: 2 });
    expect(await campaigns.getEventStatsByCampaign(campaignId)).toEqual({
      // a@x.io opened on two days: two daily uniques.
      opens: { total: 3, unique: 2 },
      clicks: { total: 1, unique: 1 },
    });
    expect(await dashboard.getGlobalStats([projectId])).toEqual({
      totalSent: 4,
      delivered: 1,
      bounced: 1,
      opened: 3,
      clicked: 1,
      savedSends: 1,
    });

    const activity = (await dashboard.getActivityStats([projectId], 3650)).filter(
      (d) => d.success || d.suppressed,
    );
    expect(activity).toEqual([
      { timestamp: "2026-11-01T00:00:00.000Z", success: 1, suppressed: 0 },
      // 23:59 UTC stays on its own day.
      { timestamp: "2026-11-02T00:00:00.000Z", success: 1, suppressed: 0 },
      { timestamp: "2026-11-03T00:00:00.000Z", success: 0, suppressed: 1 },
    ]);
  });

  it("counts a legacy STANDARD campaign from its events", async () => {
    const { projectId, campaignId } = await seedCampaign(db, "STANDARD");
    await db.insert(schema.campaignEvents).values([
      { campaignId, email: "a@x.io", type: "SENT", occurredAt: at("2026-10-20T10:00:00Z") },
      { campaignId, email: "a@x.io", type: "DELIVERED", occurredAt: at("2026-10-20T10:01:00Z") },
      { campaignId, email: "b@x.io", type: "SENT", occurredAt: at("2026-10-20T10:00:00Z") },
      { campaignId, email: "b@x.io", type: "BOUNCE", occurredAt: at("2026-10-20T10:02:00Z") },
      {
        campaignId,
        email: "c@x.io",
        type: "FAILED",
        metadata: { error: "Recipient is suppressed (Reason: SPAM)" },
        occurredAt: at("2026-10-20T10:00:00Z"),
      },
    ]);

    await backfillCampaignStats(db);

    expect(await dashboard.getGlobalStats([projectId])).toEqual({
      totalSent: 2,
      delivered: 1,
      bounced: 1,
      opened: 0,
      clicked: 0,
      savedSends: 1,
    });
  });

  it("is a no-op once done, and sets the marker retention waits for", async () => {
    const { campaignId } = await seedCampaign(db);
    await seedHistory(campaignId);

    expect(await isCampaignStatsBackfilled(db)).toBe(false);
    await backfillCampaignStats(db);
    expect(await isCampaignStatsBackfilled(db)).toBe(true);

    // Raw rows deleted afterwards (as retention will) must not be recounted.
    await db.delete(schema.triggeredSendLogs);
    expect(await backfillCampaignStats(db)).toEqual({ status: "already_done" });
    expect((await logs.getStatsByCampaign(campaignId)).sent).toBe(4);
  });

  it("counts live rows written before it once", async () => {
    const { campaignId } = await seedCampaign(db);
    const log = await logs.create({ campaignId, email: "a@x.io", status: "PENDING", error: null, data: null });
    await logs.update(log.id, { status: "SUCCESS" });
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "OPEN" });

    await backfillCampaignStats(db);

    expect(await logs.getStatsByCampaign(campaignId)).toEqual({ sent: 1, delivered: 0, errors: 0 });
    expect((await campaigns.getEventStatsByCampaign(campaignId)).opens).toEqual({ total: 1, unique: 1 });

    // Today's unique is known after the recount: the same address again is not a new one.
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "OPEN" });
    expect((await campaigns.getEventStatsByCampaign(campaignId)).opens).toEqual({ total: 2, unique: 1 });
  });
});

describe("live counting", () => {
  it("follows a send through its statuses and ignores a repeated webhook", async () => {
    const { campaignId } = await seedCampaign(db);
    const log = await logs.create({ campaignId, email: "a@x.io", status: "PENDING", error: null, data: null });
    expect(await logs.getStatsByCampaign(campaignId)).toEqual({ sent: 0, delivered: 0, errors: 0 });

    await logs.update(log.id, { status: "SUCCESS", providerMessageId: "m-1" });
    await logs.update(log.id, { status: "DELIVERED" });
    await logs.update(log.id, { status: "DELIVERED" });
    expect(await logs.getStatsByCampaign(campaignId)).toEqual({ sent: 1, delivered: 1, errors: 0 });

    // A late bounce moves the email from delivered to bounced.
    await logs.update(log.id, { status: "BOUNCED" });
    expect(await logs.getStatsByCampaign(campaignId)).toEqual({ sent: 1, delivered: 0, errors: 0 });
  });

  it("counts a suppressed send as failed and suppressed", async () => {
    const { projectId, campaignId } = await seedCampaign(db);
    const log = await logs.create({ campaignId, email: "a@x.io", status: "PENDING", error: null, data: null });
    await logs.update(log.id, { status: "FAILED", error: "Recipient is suppressed (Reason: BOUNCE)" });

    expect(await logs.getStatsByCampaign(campaignId)).toEqual({ sent: 0, delivered: 0, errors: 1 });
    expect((await dashboard.getGlobalStats([projectId])).savedSends).toBe(1);
  });

  it("counts a delivery on the day the email was sent", async () => {
    const { projectId, campaignId } = await seedCampaign(db);
    const log = await logs.create({ campaignId, email: "a@x.io", status: "PENDING", error: null, data: null });
    await logs.update(log.id, { status: "SUCCESS" });
    // Sent yesterday (rewritten past the repository), delivered today.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.update(schema.triggeredSendLogs).set({ sentAt: yesterday }).where(eq(schema.triggeredSendLogs.id, log.id));
    await db
      .update(schema.campaignDailyStats)
      .set({ day: yesterday.toISOString().slice(0, 10) })
      .where(eq(schema.campaignDailyStats.campaignId, campaignId));

    await logs.update(log.id, { status: "DELIVERED" });

    const rows = await db
      .select()
      .from(schema.campaignDailyStats)
      .where(eq(schema.campaignDailyStats.projectId, projectId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: yesterday.toISOString().slice(0, 10), sent: 1, delivered: 1 });
  });

  it("counts opens and clicks with a unique per address and day", async () => {
    const { campaignId } = await seedCampaign(db);
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "OPEN" });
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "OPEN" });
    await campaigns.logEvent({ campaignId, email: "b@x.io", type: "OPEN" });
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "CLICK", linkUrl: "https://x.io" });
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "CLICK", linkUrl: "https://x.io/2" });
    // Not an engagement event: counted from the log, not here.
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "SENT" });

    expect(await campaigns.getEventStatsByCampaign(campaignId)).toEqual({
      opens: { total: 3, unique: 2 },
      clicks: { total: 2, unique: 1 },
    });
    expect((await logs.getStatsByCampaign(campaignId)).sent).toBe(0);

    const series = await campaigns.getTimeSeriesStatsByCampaign(campaignId, { interval: "day", days: 7 });
    expect(series).toHaveLength(8);
    expect(series.at(-1)).toMatchObject({ opens: 3, clicks: 2 });

    const hourly = await campaigns.getTimeSeriesStatsByCampaign(campaignId, { interval: "hour", days: 1 });
    expect(hourly.reduce((sum, h) => sum + h.opens, 0)).toBe(3);
  });

  it("keeps the statistics when the raw rows are deleted", async () => {
    const { projectId, campaignId } = await seedCampaign(db);
    const log = await logs.create({ campaignId, email: "a@x.io", status: "PENDING", error: null, data: null });
    await logs.update(log.id, { status: "DELIVERED" });
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "OPEN" });
    await campaigns.logEvent({ campaignId, email: "a@x.io", type: "CLICK", linkUrl: "https://x.io" });

    const before = {
      log: await logs.getStatsByCampaign(campaignId),
      events: await campaigns.getEventStatsByCampaign(campaignId),
      global: await dashboard.getGlobalStats([projectId]),
      activity: await dashboard.getActivityStats([projectId], 7),
    };

    await db.delete(schema.triggeredSendLogs);
    await db.delete(schema.campaignEvents);

    expect({
      log: await logs.getStatsByCampaign(campaignId),
      events: await campaigns.getEventStatsByCampaign(campaignId),
      global: await dashboard.getGlobalStats([projectId]),
      activity: await dashboard.getActivityStats([projectId], 7),
    }).toEqual(before);
    // Link stats read the raw clicks: what retention deleted is gone there.
    expect(await campaigns.getLinkStatsByCampaign(campaignId)).toEqual([]);
  });
});
