import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redisInstance: Redis | null = null;

export function getRedisConnection() {
  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });

    redisInstance.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }

  return redisInstance;
}

export const redis = getRedisConnection();
