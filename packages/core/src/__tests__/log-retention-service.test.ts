// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { fixedLogRetention, ServiceHooks, type RetentionPolicy } from "../hooks";
import type { ILogRetentionRepository } from "../ports";
import { LogRetentionService, PENDING_GRACE_DAYS } from "../services/logRetentionService";

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const NOW = new Date("2026-11-07T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** A repository with `rows` deletable send logs and events per project, removed `limit` at a time. */
function fakeRepo(rows: Record<number, number>, { backfilled = true } = {}) {
  const logs = { ...rows };
  const events = { ...rows };
  const repo = {
    isStatsBackfilled: vi.fn(async () => backfilled),
    listProjectIds: vi.fn(async () => Object.keys(rows).map(Number)),
    deleteSendLogs: vi.fn(async (projectId: number, { limit }: { limit: number }) => {
      const n = Math.min(limit, logs[projectId] ?? 0);
      logs[projectId] -= n;
      return n;
    }),
    deleteEvents: vi.fn(async (projectId: number, { limit }: { limit: number }) => {
      const n = Math.min(limit, events[projectId] ?? 0);
      events[projectId] -= n;
      return n;
    }),
    deleteDailyUniques: vi.fn(async () => 0),
  } satisfies ILogRetentionRepository;
  return { repo, logs, events };
}

const service = (repo: ILogRetentionRepository, retention?: RetentionPolicy, batchSize = 10) =>
  new LogRetentionService(repo, new ServiceHooks({ retention }, logger), logger, { batchSize, now: () => NOW });

describe("LogRetentionService", () => {
  it("deletes in batches until a batch comes back short", async () => {
    const { repo, logs, events } = fakeRepo({ 1: 25 });

    const result = await service(repo, fixedLogRetention(30)).run();

    expect(result).toMatchObject({ status: "done", sendLogs: 25, events: 25, projects: 1 });
    expect(logs[1]).toBe(0);
    expect(events[1]).toBe(0);
    // 10 + 10 + 5: the short third batch ends the loop.
    expect(repo.deleteSendLogs).toHaveBeenCalledTimes(3);
    expect(repo.deleteEvents).toHaveBeenCalledTimes(3);
  });

  it("cuts at the project's retention and keeps PENDING sends of the last days", async () => {
    const { repo } = fakeRepo({ 1: 1 });

    await service(repo, fixedLogRetention(7)).run();

    expect(repo.deleteSendLogs).toHaveBeenCalledWith(1, {
      before: new Date(NOW.getTime() - 7 * DAY),
      keepPendingSince: new Date(NOW.getTime() - PENDING_GRACE_DAYS * DAY),
      limit: 10,
    });
    expect(repo.deleteEvents).toHaveBeenCalledWith(1, { before: new Date(NOW.getTime() - 7 * DAY), limit: 10 });
  });

  it("deletes nothing without a retention: self-hosted without LOG_RETENTION_DAYS", async () => {
    const { repo } = fakeRepo({ 1: 5, 2: 5 });

    const result = await service(repo, fixedLogRetention(null)).run();
    expect(await service(repo).run()).toEqual(result);

    expect(result).toMatchObject({ status: "done", sendLogs: 0, events: 0, projects: 0 });
    expect(repo.deleteSendLogs).not.toHaveBeenCalled();
    expect(repo.deleteEvents).not.toHaveBeenCalled();
  });

  it("deletes no log row or event before the statistics backfill, but prunes old uniques", async () => {
    const { repo } = fakeRepo({ 1: 5 }, { backfilled: false });

    const result = await service(repo, fixedLogRetention(1)).run();

    expect(result.status).toBe("not_backfilled");
    expect(repo.deleteSendLogs).not.toHaveBeenCalled();
    expect(repo.deleteEvents).not.toHaveBeenCalled();
    expect(repo.deleteDailyUniques).toHaveBeenCalledWith({ beforeDay: "2026-11-06", limit: 10 });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("db:backfill-stats"));
  });

  it("applies each project's own retention and skips one whose policy fails or answers nonsense", async () => {
    const { repo, logs } = fakeRepo({ 1: 3, 2: 3, 3: 3, 4: 3 });
    const retention: RetentionPolicy = {
      async logRetentionDays(projectId) {
        if (projectId === 2) throw new Error("plan lookup down");
        if (projectId === 3) return 0;
        if (projectId === 4) return null;
        return 30;
      },
    };

    const result = await service(repo, retention).run();

    expect(result).toMatchObject({ sendLogs: 3, projects: 1 });
    expect(logs).toEqual({ 1: 0, 2: 3, 3: 3, 4: 3 });
    expect(logger.error).toHaveBeenCalledWith("Retention policy failed", { projectId: 2, error: "plan lookup down" });
  });
});
