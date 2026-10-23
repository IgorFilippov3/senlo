// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  RateLimiter,
  RateLimitedError,
  type Logger,
  type RateLimitRule,
  type RateLimitStore,
} from "@senlo/core";

/**
 * Per-caller limits. Generous for machine traffic, tight where a human is
 * guessing something - a password, or the address behind a legacy
 * unsubscribe link. Tracking pixels and click redirects are deliberately not
 * limited: mail clients fetch them through shared proxies (Gmail's serves
 * every Gmail user), so a per-IP limit would drop real opens and clicks, and
 * the sealed tokens leave nothing to guess.
 */
export const RATE_LIMITS = {
  /** Public API: /api/events, /api/triggered. */
  api: { limit: 1200, windowSeconds: 60 },
  /** Provider webhooks; already authenticated, just a flood guard. */
  webhook: { limit: 6000, windowSeconds: 60 },
  /**
   * The unsubscribe page, where a legacy link is confirmed by typing the
   * address: tight, so addresses cannot be tried in a loop.
   */
  unsubscribe: { limit: 30, windowSeconds: 60 },
  /**
   * One-click unsubscribe. Gmail and Yahoo post it from their own servers,
   * many recipients per IP, and it accepts only sealed tokens - nothing to
   * guess - so it gets the flood guard, not the human limit.
   */
  oneClick: { limit: 6000, windowSeconds: 60 },
  /** Failed password sign-ins, per address and per IP. */
  login: { limit: 10, windowSeconds: 300 },
  register: { limit: 10, windowSeconds: 3600 },
  /** AI generation costs the user money per call. */
  ai: { limit: 20, windowSeconds: 60 },
  upload: { limit: 60, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

/**
 * The caller's address. `x-real-ip` is what a reverse proxy sets; failing
 * that, the last `x-forwarded-for` hop is the one the nearest proxy added.
 * The first hop is whatever the client claimed, so it is not used here.
 *
 * Null when neither header is there. Callers must not fall back to a shared
 * placeholder: every request would then land in one counter, and one limit
 * would be shared by the whole instance.
 */
export function clientIp(source: Headers): string | null {
  const real = source.get("x-real-ip")?.trim();
  if (real) return real;
  const last = source.get("x-forwarded-for")?.split(",").pop()?.trim();
  return last || null;
}

export interface RateLimitOptions {
  /** Counters (Redis in practice: `redisRateLimitStore` from `@senlo/core/queue`). */
  store: RateLimitStore;
  /** Key prefix; a function is read on first use, so a host can take it from its config lazily. */
  prefix: string | (() => string);
  /** Gets a warning when the store is down (the limiter then lets requests through). */
  logger: Logger;
  /** Overrides per bucket; the rest keep `RATE_LIMITS`. */
  limits?: Partial<Record<RateLimitBucket, RateLimitRule>>;
}

export interface SenloRateLimit {
  /** The rules in force: `RATE_LIMITS` with the host's overrides. */
  readonly limits: Readonly<Record<RateLimitBucket, RateLimitRule>>;
  /**
   * For route handlers: a 429 response when over the limit, otherwise null.
   * Without an explicit caller it limits by IP, and skips when the IP is unknown.
   */
  limitRequest(request: Request, bucket: RateLimitBucket, caller?: string): Promise<NextResponse | null>;
  /**
   * For Server Actions: counts the attempt and throws `RateLimitedError` when
   * any caller is over the limit. Each caller is counted (the IP, when known,
   * plus the given ones), so an action can be limited by IP and by something
   * else at once.
   */
  limitAction(bucket: RateLimitBucket, ...callers: string[]): Promise<void>;
  /**
   * Password sign-in counts failures only: checked before the attempt,
   * recorded when the password is wrong, cleared for the address when it is
   * right. Per address and per IP, so guessing one account from many
   * addresses is limited as well as many accounts from one address.
   */
  assertLoginAllowed(email: string): Promise<void>;
  recordLoginFailure(email: string): Promise<void>;
  /** Only the address: the IP may be shared, and others behind it may still be guessing. */
  resetLoginFailures(email: string): Promise<void>;
}

const loginKey = (email: string) => `email:${email.trim().toLowerCase()}`;

/** The host's rate limits. The limiter itself is created on first use. */
export function createRateLimit(options: RateLimitOptions): SenloRateLimit {
  const limits = Object.freeze({ ...RATE_LIMITS, ...options.limits });
  let limiter: RateLimiter | undefined;

  const getLimiter = () =>
    (limiter ??= new RateLimiter(
      options.store,
      typeof options.prefix === "function" ? options.prefix() : options.prefix,
      (error) =>
        options.logger.warn("Rate limiter unavailable, letting the request through", {
          error: error instanceof Error ? error.message : String(error),
        }),
    ));

  /** The IP caller key, when the IP is known, followed by the given ones. */
  const callersFor = async (extra: string[]) => {
    const ip = clientIp(await headers());
    return [...(ip ? [`ip:${ip}`] : []), ...extra];
  };

  return {
    limits,

    async limitRequest(request, bucket, caller) {
      const key = caller ?? clientIp(request.headers);
      if (!key) return null;

      const result = await getLimiter().check(bucket, key, limits[bucket]);
      if (result.allowed) return null;

      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      );
    },

    async limitAction(bucket, ...callers) {
      for (const caller of await callersFor(callers)) {
        const result = await getLimiter().check(bucket, caller, limits[bucket]);
        if (!result.allowed) throw new RateLimitedError(result.retryAfter);
      }
    },

    async assertLoginAllowed(email) {
      for (const caller of await callersFor([loginKey(email)])) {
        const result = await getLimiter().isBlocked("login", caller, limits.login);
        if (!result.allowed) throw new RateLimitedError(result.retryAfter);
      }
    },

    async recordLoginFailure(email) {
      for (const caller of await callersFor([loginKey(email)])) {
        await getLimiter().recordFailure("login", caller, limits.login);
      }
    },

    async resetLoginFailures(email) {
      await getLimiter().reset("login", loginKey(email), limits.login);
    },
  };
}
