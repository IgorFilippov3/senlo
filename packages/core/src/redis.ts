// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Redis } from "ioredis";
import { consoleLogger, type Logger } from "./logger";

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
