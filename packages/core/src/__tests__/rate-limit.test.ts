import { describe, it, expect } from "vitest";
import { RateLimiter, type RateLimitStore } from "../rate-limit";

function memoryStore(): RateLimitStore & { keys: Map<string, number> } {
  const keys = new Map<string, number>();
  return {
    keys,
    async increment(key) {
      const next = (keys.get(key) ?? 0) + 1;
      keys.set(key, next);
      return next;
    },
    async get(key) {
      return keys.get(key) ?? 0;
    },
    async delete(key) {
      keys.delete(key);
    },
  };
}

const rule = { limit: 3, windowSeconds: 60 };
const T0 = 60_000 * 28_333_334 + 40_000; // 40 s into a minute window

describe("RateLimiter", () => {
  it("allows up to the limit in one window, then refuses", async () => {
    const limiter = new RateLimiter(memoryStore());
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await limiter.check("login", "ip1", rule, T0)).allowed);
    expect(results).toEqual([true, true, true, false]);
  });

  it("counts callers and buckets separately", async () => {
    const limiter = new RateLimiter(memoryStore());
    for (let i = 0; i < 3; i++) await limiter.check("login", "ip1", rule, T0);

    expect((await limiter.check("login", "ip2", rule, T0)).allowed).toBe(true);
    expect((await limiter.check("api", "ip1", rule, T0)).allowed).toBe(true);
  });

  it("starts over in the next window and says when that is", async () => {
    const limiter = new RateLimiter(memoryStore());
    for (let i = 0; i < 4; i++) await limiter.check("login", "ip1", rule, T0);

    const refused = await limiter.check("login", "ip1", rule, T0);
    expect(refused.retryAfter).toBe(20);
    expect((await limiter.check("login", "ip1", rule, T0 + 20_000)).allowed).toBe(true);
  });

  it("lets requests through when the store fails, and reports it", async () => {
    const errors: unknown[] = [];
    const limiter = new RateLimiter(
      {
        increment: async () => { throw new Error("redis down"); },
        get: async () => { throw new Error("redis down"); },
        delete: async () => { throw new Error("redis down"); },
      },
      "senlo:rl",
      (error) => errors.push(error),
    );

    expect((await limiter.check("login", "ip1", rule, T0)).allowed).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it("with failures only: blocks after the limit of failures, not of attempts", async () => {
    const limiter = new RateLimiter(memoryStore());

    // Checking does not count: any number of successful attempts is fine.
    for (let i = 0; i < 10; i++) {
      expect((await limiter.isBlocked("login", "ann", rule, T0)).allowed).toBe(true);
    }

    for (let i = 0; i < 3; i++) await limiter.recordFailure("login", "ann", rule, T0);
    expect((await limiter.isBlocked("login", "ann", rule, T0)).allowed).toBe(false);
  });

  it("reset clears the failures", async () => {
    const limiter = new RateLimiter(memoryStore());
    for (let i = 0; i < 3; i++) await limiter.recordFailure("login", "ann", rule, T0);

    await limiter.reset("login", "ann", rule, T0);
    expect((await limiter.isBlocked("login", "ann", rule, T0)).allowed).toBe(true);
  });
});
