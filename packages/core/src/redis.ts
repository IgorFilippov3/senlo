// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Redis } from "ioredis";
import { consoleLogger, type Logger } from "./logger";
import type { RateLimitStore } from "./rate-limit";

/**
 * A Redis connection for queues, workers and the rate limiter. Nothing
 * connects on import any more: the app creates the connection from its
 * config and passes it to whatever needs it.
 */
export function createRedisConnection(
  url: string,
  logger: Logger = consoleLogger,
): Redis {
  const connection = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });

  connection.on("error", (err) => {
    logger.error("Redis connection error", { error: err.message });
  });

  return connection;
}

/**
 * Rate limit counters in Redis. Takes a getter, so the connection is still
 * created on first use: a host builds its limiter at import time, before
 * anything should connect.
 */
export function redisRateLimitStore(redis: () => Redis): RateLimitStore {
  return {
    async increment(key, ttlSeconds) {
      const results = await redis().multi().incr(key).expire(key, ttlSeconds).exec();
      const [error, count] = results?.[0] ?? [];
      if (error) throw error;
      return Number(count);
    },
    async get(key) {
      return Number((await redis().get(key)) ?? 0);
    },
    async delete(key) {
      await redis().del(key);
    },
  };
}
