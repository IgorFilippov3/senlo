// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import type { Logger, RateLimitStore } from "@senlo/core";
import { RATE_LIMITS, clientIp, createRateLimit } from "../rate-limit";

const memoryStore = (): RateLimitStore & { counts: Map<string, number> } => {
  const counts = new Map<string, number>();
  return {
    counts,
    async increment(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async get(key) {
      return counts.get(key) ?? 0;
    },
    async delete(key) {
      counts.delete(key);
    },
  };
};

const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const request = (ip?: string) =>
  new Request("http://localhost/api/events", { headers: ip ? { "x-real-ip": ip } : {} });

describe("createRateLimit", () => {
  it("answers 429 with Retry-After once a caller is over the limit", async () => {
    const rateLimit = createRateLimit({
      store: memoryStore(),
      prefix: "t:rl",
      logger,
      limits: { api: { limit: 2, windowSeconds: 60 } },
    });

    expect(await rateLimit.limitRequest(request("1.2.3.4"), "api")).toBeNull();
    expect(await rateLimit.limitRequest(request("1.2.3.4"), "api")).toBeNull();
    const refused = await rateLimit.limitRequest(request("1.2.3.4"), "api");

    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Another caller has its own counter.
    expect(await rateLimit.limitRequest(request("5.6.7.8"), "api")).toBeNull();
  });

  it("skips the limit when the IP is unknown and no caller is given", async () => {
    const store = memoryStore();
    const rateLimit = createRateLimit({ store, prefix: "t:rl", logger });

    expect(await rateLimit.limitRequest(request(), "api")).toBeNull();
    expect(store.counts.size).toBe(0);
  });

  it("keeps RATE_LIMITS for buckets the host does not override", () => {
    const rateLimit = createRateLimit({
      store: memoryStore(),
      prefix: "t:rl",
      logger,
      limits: { ai: { limit: 5, windowSeconds: 60 } },
    });
    expect(rateLimit.limits.ai).toEqual({ limit: 5, windowSeconds: 60 });
    expect(rateLimit.limits.api).toEqual(RATE_LIMITS.api);
  });

  it("reads a lazy prefix on first use and fails open when the store is down", async () => {
    const prefix = vi.fn(() => "lazy:rl");
    const broken: RateLimitStore = {
      increment: async () => {
        throw new Error("redis down");
      },
      get: async () => 0,
      delete: async () => {},
    };
    const warn = vi.fn();
    const rateLimit = createRateLimit({ store: broken, prefix, logger: { ...logger, warn } });

    expect(prefix).not.toHaveBeenCalled();
    expect(await rateLimit.limitRequest(request("1.2.3.4"), "api")).toBeNull();
    expect(prefix).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("Rate limiter unavailable, letting the request through", {
      error: "redis down",
    });
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip, then the last x-forwarded-for hop, else null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1" }))).toBe("10.0.0.1");
    expect(clientIp(new Headers())).toBeNull();
  });
});
