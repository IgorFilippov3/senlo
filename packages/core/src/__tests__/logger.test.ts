// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../errors";
import { createLogger, logError, type Logger } from "../logger";
import { redisRateLimitStore } from "../redis";

afterEach(() => vi.restoreAllMocks());

const lines = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((call) => JSON.parse(String(call[0])));

describe("createLogger", () => {
  it("writes one JSON object per line outside development, with a stack only on error", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = createLogger({ development: false });

    logger.info("hello", { projectId: 1, stack: "ignored on info" });
    logger.error("boom", { stack: "Error: boom\n    at here" });

    const [info, error] = lines(log);
    expect(info).toMatchObject({ level: "info", message: "hello", context: { projectId: 1 } });
    expect(info.stack).toBeUndefined();
    expect(error).toMatchObject({ level: "error", message: "boom", stack: "Error: boom\n    at here" });
  });

  it("drops debug outside development and keeps it in development", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createLogger({ development: false }).debug("quiet");
    expect(log).not.toHaveBeenCalled();

    createLogger({ development: true }).debug("loud");
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("DEBUG: loud");
  });
});

describe("logError", () => {
  const fakeLogger = () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    return logger satisfies Logger;
  };

  it("logs an AppError as a warning with its code and no stack", () => {
    const logger = fakeLogger();
    logError(logger, "Event API error", new NotFoundError("Project"), { projectId: 7 });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith("Event API error", {
      projectId: 7,
      code: "NOT_FOUND",
      error: "Project not found",
    });
  });

  it("logs anything else as an error with the error's own stack", () => {
    const logger = fakeLogger();
    const failure = new Error("connection refused");
    logError(logger, "Upload failed", failure);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Upload failed", {
      error: "connection refused",
      stack: failure.stack,
    });
  });

  it("copes with a thrown non-error", () => {
    const logger = fakeLogger();
    logError(logger, "Odd", "just a string");
    expect(logger.error).toHaveBeenCalledWith("Odd", { error: "just a string" });
  });
});

describe("redisRateLimitStore", () => {
  it("increments with an expiry and reads counters through the getter's connection", async () => {
    const calls: string[] = [];
    const multi = {
      incr: (key: string) => (calls.push(`incr ${key}`), multi),
      expire: (key: string, ttl: number) => (calls.push(`expire ${key} ${ttl}`), multi),
      exec: async () => [[null, 3]],
    };
    const redis = {
      multi: () => multi,
      get: async () => "5",
      del: async (key: string) => (calls.push(`del ${key}`), 1),
    };
    const getter = vi.fn(() => redis as never);
    const store = redisRateLimitStore(getter);

    expect(getter).not.toHaveBeenCalled();
    expect(await store.increment("k", 60)).toBe(3);
    expect(await store.get("k")).toBe(5);
    await store.delete("k");
    expect(calls).toEqual(["incr k", "expire k 60", "del k"]);
  });

  it("passes a failed increment on, so the limiter can fail open", async () => {
    const multi = { incr: () => multi, expire: () => multi, exec: async () => [[new Error("down"), null]] };
    const store = redisRateLimitStore(() => ({ multi: () => multi }) as never);
    await expect(store.increment("k", 60)).rejects.toThrow("down");
  });
});
