// First: the environment has to be in place before anything reads it.
import "./lib/load-env";
import { createDb, createRepositories } from "@senlo/db";
import { ConfigError, loadSenloConfig, mailSettings } from "@senlo/core";
import { createRedisConnection, startWorkers } from "@senlo/core/queue";
import { logger } from "./lib/logger";

// Checked before anything connects: a broken config stops the worker with
// the full list of what to fix, instead of failing on the first job.
let config: ReturnType<typeof loadSenloConfig>;
try {
  config = loadSenloConfig(process.env);
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
}

const workers = startWorkers({
  repositories: createRepositories(createDb(config.databaseUrl)),
  connection: {
    connection: createRedisConnection(config.redisUrl, logger),
    prefix: config.queuePrefix,
  },
  settings: mailSettings(config),
  logger,
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down workers");
  await workers.close();
  process.exit(0);
});
