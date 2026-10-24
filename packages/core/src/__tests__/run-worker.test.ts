// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SenloConfig } from "../config";

const mocks = vi.hoisted(() => ({
  redis: { quit: vi.fn(async () => "OK") },
  close: vi.fn(async () => {}),
  startWorkers: vi.fn(),
  createRedisConnection: vi.fn(),
}));
vi.mock("../redis", () => ({ createRedisConnection: mocks.createRedisConnection }));
vi.mock("../queue/start-workers", () => ({ startWorkers: mocks.startWorkers }));

import { runSenloWorker } from "../queue/run-worker";

const config = {
  redisUrl: "redis://cache:6379",
  queuePrefix: "acme",
  appUrl: "https://app.example",
  linkSigningSecret: "s3cret",
  defaultFromEmail: "hi@example.com",
} as SenloConfig;
const repositories = { campaigns: {} } as never;
const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let handlers: Record<string, () => void>;
let exit: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  handlers = {};
  vi.spyOn(process, "once").mockImplementation(((signal: string, handler: () => void) => {
    handlers[signal] = handler;
    return process;
  }) as never);
  exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  mocks.createRedisConnection.mockReturnValue(mocks.redis);
  mocks.startWorkers.mockReturnValue({ close: mocks.close });
});
afterEach(() => vi.restoreAllMocks());

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("runSenloWorker", () => {
  it("starts the workers on the config's Redis and prefix with the host's ports", () => {
    const usage = { record: vi.fn() };
    const workers = runSenloWorker({ config, repositories, logger, usage });

    expect(mocks.createRedisConnection).toHaveBeenCalledWith("redis://cache:6379", logger);
    expect(mocks.startWorkers).toHaveBeenCalledWith({
      repositories,
      connection: { connection: mocks.redis, prefix: "acme" },
      settings: {
        appUrl: "https://app.example",
        linkSigningSecret: "s3cret",
        defaultFromEmail: "hi@example.com",
      },
      logger,
      usage,
    });
    expect(workers.close).toBe(mocks.close);
    expect(Object.keys(handlers).sort()).toEqual(["SIGINT", "SIGTERM"]);
  });

  it("on SIGTERM closes the workers, then Redis, and exits 0; a second signal is ignored", async () => {
    runSenloWorker({ config, repositories, logger });
    handlers.SIGTERM();
    handlers.SIGINT();
    await flush();

    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.redis.quit).toHaveBeenCalledTimes(1);
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.redis.quit.mock.invocationCallOrder[0],
    );
    expect(exit).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith("Shutting down workers", { signal: "SIGTERM" });
  });

  it("exits 1 and logs when stopping fails", async () => {
    mocks.close.mockRejectedValueOnce(new Error("stuck job"));
    runSenloWorker({ config, repositories, logger });
    handlers.SIGINT();
    await flush();

    expect(logger.error).toHaveBeenCalledWith("Worker shutdown failed", { error: "stuck job" });
    expect(exit).toHaveBeenCalledWith(1);
  });
});
