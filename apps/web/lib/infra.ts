import type { Redis } from "ioredis";
import {
  createQueues,
  createRedisConnection,
  type QueueConnection,
  type SenloQueues,
} from "@senlo/core/queue";
import { mailSettings } from "@senlo/core";
import { getConfig } from "./config";
import { logger } from "./logger";

/**
 * The app's connections, created on first use from its config. One Redis
 * connection is shared by the queues and the rate limiter.
 */
let redis: Redis | undefined;
let queues: SenloQueues | undefined;

export function getRedis(): Redis {
  return (redis ??= createRedisConnection(getConfig().redisUrl, logger));
}

export function queueConnection(): QueueConnection {
  return { connection: getRedis(), prefix: getConfig().queuePrefix };
}

export function getQueues(): SenloQueues {
  return (queues ??= createQueues(queueConnection()));
}

/** What outgoing mail needs from the config: app URL, signing secret, default sender. */
export function getMailSettings() {
  return mailSettings(getConfig());
}
