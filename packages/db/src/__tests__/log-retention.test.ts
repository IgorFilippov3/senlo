// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { fixedLogRetention, ServiceHooks, type Logger, type RetentionPolicy } from "@senlo/core";
import { LogRetentionService } from "@senlo/core/server";
import type { Database } from "../client";
import * as schema from "../schema";
import { backfillCampaignStats } from "../campaign-stats";
import { CampaignRepository } from "../repositories/campaignRepository";
import { DashboardRepository } from "../repositories/dashboardRepository";
import { LogRetentionRepository } from "../repositories/logRetentionRepository";
import { TriggeredSendLogRepository } from "../repositories/triggeredSendLogRepository";
import { createTestDb, seedCampaign } from "./test-db";

const quiet: Logger = { debug() {}, info() {}, warn() {}, error() {} };
const NOW = new Date("2026-11-07T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

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

const retentionRun = (retention: RetentionPolicy | undefined, batchSize = 4) =>
  new LogRetentionService(new LogRetentionRepository(db), new ServiceHooks({ retention }, quiet), quiet, {
    batchSize,
    now: () => NOW,
  }).run();

/** `count` delivered and opened sends through the repositories, then dated `ageDays` back. */
async function sendAndAge(campaignId: number, count: number, ageDays: number) {
  for (let i = 0; i < count; i++) {
    const log = await logs.create({ campaignId, email: `r${ageDays}-${i}@x.io`, status: "PENDING", error: null, data: { order: i } });
    await logs.update(log.id, { status: "DELIVERED" });
    const event = await campaigns.logEvent({ campaignId, email: `r${ageDays}-${i}@x.io`, type: "OPEN" });
    await db.update(schema.triggeredSendLogs).set({ sentAt: daysAgo(ageDays) }).where(eq(schema.triggeredSendLogs.id, log.id));
    await db.update(schema.campaignEvents).set({ occurredAt: daysAgo(ageDays) }).where(eq(schema.campaignEvents.id, event.id));
  }
}

async function remaining(campaignId: number) {
  const logRows = await db.select().from(schema.triggeredSendLogs).where(eq(schema.triggeredSendLogs.campaignId, campaignId));
  const eventRows = await db.select().from(schema.campaignEvents).where(eq(schema.campaignEvents.campaignId, campaignId));
  return { logs: logRows, events: eventRows };
}

describe("log retention", () => {
  it("deletes rows past the retention in batches and leaves newer ones", async () => {
    const { campaignId } = await seedCampaign(db);
    await sendAndAge(campaignId, 10, 40);
    await sendAndAge(campaignId, 3, 10);
    await backfillCampaignStats(db);

    const result = await retentionRun(fixedLogRetention(30), 4);

    expect(result).toMatchObject({ status: "done", sendLogs: 10, events: 10, projects: 1 });
    const left = await remaining(campaignId);
    expect(left.logs).toHaveLength(3);
    expect(left.events).toHaveLength(3);
    expect(left.logs.every((l) => l.sentAt.getTime() === daysAgo(10).getTime())).toBe(true);
  });

  it("does not change the statistics", async () => {
    const { projectId, campaignId } = await seedCampaign(db);
    await sendAndAge(campaignId, 6, 40);
    await campaigns.logEvent({ campaignId, email: "r40-0@x.io", type: "CLICK", linkUrl: "https://x.io" });
    await backfillCampaignStats(db);

    const snapshot = async () => ({
      log: await logs.getStatsByCampaign(campaignId),
      events: await campaigns.getEventStatsByCampaign(campaignId),
      global: await dashboard.getGlobalStats([projectId]),
      activity: await dashboard.getActivityStats([projectId], 60),
      daily: await campaigns.getTimeSeriesStatsByCampaign(campaignId, { interval: "day", days: 60 }),
    });
    const before = await snapshot();
    expect(before.log.sent).toBe(6);

    await retentionRun(fixedLogRetention(7));

    expect((await remaining(campaignId)).logs).toHaveLength(0);
    expect(await snapshot()).toEqual(before);
  });

  it("keeps a PENDING send younger than three days, whatever the retention", async () => {
    const { campaignId } = await seedCampaign(db);
    await db.insert(schema.triggeredSendLogs).values([
      { campaignId, email: "queued@x.io", status: "PENDING", sentAt: daysAgo(2) },
      { campaignId, email: "stuck@x.io", status: "PENDING", sentAt: daysAgo(5) },
      { campaignId, email: "sent@x.io", status: "SUCCESS", sentAt: daysAgo(2) },
    ]);
    await backfillCampaignStats(db);

    await retentionRun(fixedLogRetention(1));

    expect((await remaining(campaignId)).logs.map((l) => l.email)).toEqual(["queued@x.io"]);
  });

  it("deletes nothing without a retention (self-hosted, LOG_RETENTION_DAYS unset)", async () => {
    const { campaignId } = await seedCampaign(db);
    await sendAndAge(campaignId, 3, 400);
    await backfillCampaignStats(db);

    expect(await retentionRun(fixedLogRetention(null))).toMatchObject({ sendLogs: 0, events: 0 });
    expect(await retentionRun(undefined)).toMatchObject({ sendLogs: 0, events: 0 });

    const left = await remaining(campaignId);
    expect(left.logs).toHaveLength(3);
    expect(left.events).toHaveLength(3);
  });

  it("deletes nothing before the statistics backfill", async () => {
    const { campaignId } = await seedCampaign(db);
    await sendAndAge(campaignId, 3, 40);

    expect((await retentionRun(fixedLogRetention(7))).status).toBe("not_backfilled");
    expect((await remaining(campaignId)).logs).toHaveLength(3);
  });

  it("applies each project's retention to its own rows only", async () => {
    const a = await seedCampaign(db);
    const b = await seedCampaign(db);
    await sendAndAge(a.campaignId, 2, 40);
    await sendAndAge(b.campaignId, 2, 40);
    await backfillCampaignStats(db);

    await retentionRun({ logRetentionDays: async (projectId) => (projectId === a.projectId ? 30 : 90) });

    expect((await remaining(a.campaignId)).logs).toHaveLength(0);
    expect((await remaining(b.campaignId)).logs).toHaveLength(2);
  });

  it("prunes the record of unique openers older than yesterday", async () => {
    const { campaignId } = await seedCampaign(db);
    await db.insert(schema.campaignDailyUniques).values([
      { campaignId, day: "2026-11-01", kind: "OPEN", email: "a@x.io" },
      { campaignId, day: "2026-11-06", kind: "OPEN", email: "a@x.io" },
      { campaignId, day: "2026-11-07", kind: "CLICK", email: "a@x.io" },
    ]);

    const result = await retentionRun(undefined);

    expect(result.dailyUniques).toBe(1);
    const days = (await db.select().from(schema.campaignDailyUniques)).map((u) => u.day).sort();
    expect(days).toEqual(["2026-11-06", "2026-11-07"]);
  });
});
