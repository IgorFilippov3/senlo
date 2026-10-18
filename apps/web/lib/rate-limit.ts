import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { RateLimiter, RateLimitedError, type RateLimitRule } from "@senlo/core";
import { getRedis } from "./infra";
import { getConfig } from "./config";
import { logger } from "./logger";

let limiter: RateLimiter | undefined;

/** Created on first use, once the config can be read. */
function getLimiter(): RateLimiter {
  return (limiter ??= new RateLimiter(
    {
      async increment(key, ttlSeconds) {
        const results = await getRedis()
          .multi()
          .incr(key)
          .expire(key, ttlSeconds)
          .exec();
        const [error, count] = results?.[0] ?? [];
        if (error) throw error;
        return Number(count);
      },
      async get(key) {
        return Number((await getRedis().get(key)) ?? 0);
      },
      async delete(key) {
        await getRedis().del(key);
      },
    },
    `${getConfig().queuePrefix}:rl`,
    (error) =>
      logger.warn("Rate limiter unavailable, letting the request through", {
        error: error instanceof Error ? error.message : String(error),
      }),
  ));
}

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

type Bucket = keyof typeof RATE_LIMITS;

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

/**
 * For route handlers: a 429 response when over the limit, otherwise null.
 * Without an explicit caller it limits by IP, and skips when the IP is unknown.
 */
export async function limitRequest(
  request: NextRequest,
  bucket: Bucket,
  caller?: string,
): Promise<NextResponse | null> {
  const key = caller ?? clientIp(request.headers);
  if (!key) return null;

  const result = await getLimiter().check(bucket, key, RATE_LIMITS[bucket]);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
  );
}

/** The IP caller key, when the IP is known, followed by the given ones. */
async function callersFor(extra: string[]): Promise<string[]> {
  const ip = clientIp(await headers());
  return [...(ip ? [`ip:${ip}`] : []), ...extra];
}

/**
 * For server actions: counts the attempt and throws `RateLimitedError` when
 * any caller is over the limit. Each caller is counted, so an action can be
 * limited by IP and by something else at once.
 */
export async function limitAction(bucket: Bucket, ...callers: string[]) {
  for (const caller of await callersFor(callers)) {
    const result = await getLimiter().check(bucket, caller, RATE_LIMITS[bucket]);
    if (!result.allowed) throw new RateLimitedError(result.retryAfter);
  }
}

const loginKey = (email: string) => `email:${email.trim().toLowerCase()}`;

/**
 * Password sign-in counts failures only: checked before the attempt,
 * recorded when the password is wrong, cleared for the address when it is
 * right. Per address and per IP, so guessing one account from many addresses
 * is limited as well as many accounts from one address.
 */
export async function assertLoginAllowed(email: string) {
  for (const caller of await callersFor([loginKey(email)])) {
    const result = await getLimiter().isBlocked("login", caller, RATE_LIMITS.login);
    if (!result.allowed) throw new RateLimitedError(result.retryAfter);
  }
}

export async function recordLoginFailure(email: string) {
  for (const caller of await callersFor([loginKey(email)])) {
    await getLimiter().recordFailure("login", caller, RATE_LIMITS.login);
  }
}

/** Only the address: the IP may be shared, and others behind it may still be guessing. */
export async function resetLoginFailures(email: string) {
  await getLimiter().reset("login", loginKey(email), RATE_LIMITS.login);
}
