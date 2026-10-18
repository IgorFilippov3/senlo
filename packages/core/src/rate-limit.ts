// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Where counters live. Redis in practice; anything with an atomic increment
 * and an expiry will do, which keeps this module free of a Redis import.
 */
export interface RateLimitStore {
  /** Increments `key`, makes it expire in `ttlSeconds`, returns the new count. */
  increment(key: string, ttlSeconds: number): Promise<number>;
  /** The current count, 0 when the key does not exist. */
  get(key: string): Promise<number>;
  delete(key: string): Promise<void>;
}

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window ends; what Retry-After should say. */
  retryAfter: number;
}

/**
 * Fixed-window counter: at most `limit` hits per `windowSeconds` for one
 * bucket and caller. Coarse - a burst can straddle two windows - but one
 * round trip per check and enough to stop floods and password guessing.
 *
 * Fails open. When the store is unreachable the request goes through: a
 * Redis outage must not take login, sending and unsubscribes down with it.
 */
export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly prefix = "senlo:rl",
    private readonly onStoreError: (error: unknown) => void = () => {},
  ) {}

  private window(rule: RateLimitRule, now: number) {
    const windowMs = rule.windowSeconds * 1000;
    const window = Math.floor(now / windowMs);
    return {
      window,
      retryAfter: Math.max(1, Math.ceil(((window + 1) * windowMs - now) / 1000)),
    };
  }

  private key(bucket: string, caller: string, window: number) {
    return `${this.prefix}:${bucket}:${caller}:${window}`;
  }

  /** Counts this request and says whether it is within the limit. */
  async check(
    bucket: string,
    caller: string,
    rule: RateLimitRule,
    now: number = Date.now(),
  ): Promise<RateLimitResult> {
    const { window, retryAfter } = this.window(rule, now);
    try {
      const count = await this.store.increment(
        this.key(bucket, caller, window),
        rule.windowSeconds,
      );
      return { allowed: count <= rule.limit, retryAfter };
    } catch (error) {
      this.onStoreError(error);
      return { allowed: true, retryAfter };
    }
  }

  /**
   * Whether the caller has already used up the window, without counting this
   * request. With {@link recordFailure} it limits only failed attempts - a
   * login that succeeds is never what locks an account.
   */
  async isBlocked(
    bucket: string,
    caller: string,
    rule: RateLimitRule,
    now: number = Date.now(),
  ): Promise<RateLimitResult> {
    const { window, retryAfter } = this.window(rule, now);
    try {
      const count = await this.store.get(this.key(bucket, caller, window));
      return { allowed: count < rule.limit, retryAfter };
    } catch (error) {
      this.onStoreError(error);
      return { allowed: true, retryAfter };
    }
  }

  async recordFailure(
    bucket: string,
    caller: string,
    rule: RateLimitRule,
    now: number = Date.now(),
  ): Promise<void> {
    const { window } = this.window(rule, now);
    try {
      await this.store.increment(this.key(bucket, caller, window), rule.windowSeconds);
    } catch (error) {
      this.onStoreError(error);
    }
  }

  /** Clears the caller's current window, e.g. after a successful login. */
  async reset(
    bucket: string,
    caller: string,
    rule: RateLimitRule,
    now: number = Date.now(),
  ): Promise<void> {
    const { window } = this.window(rule, now);
    try {
      await this.store.delete(this.key(bucket, caller, window));
    } catch (error) {
      this.onStoreError(error);
    }
  }
}
