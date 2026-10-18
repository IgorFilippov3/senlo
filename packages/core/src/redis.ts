// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Redis } from "ioredis";

/**
 * A Redis connection for queues, workers and the rate limiter. Nothing
 * connects on import any more: the app creates the connection from its
 * config and passes it to whatever needs it.
 */
export function createRedisConnection(url: string): Redis {
  const connection = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });

  connection.on("error", (err) => {
    console.error("Redis connection error:", err);
  });

  return connection;
}
