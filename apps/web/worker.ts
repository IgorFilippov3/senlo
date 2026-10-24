// First: the environment has to be in place before anything reads it.
import "./lib/load-env";
import { createDb, createRepositories } from "@senlo/db";
import { aesGcmCipher, ConfigError, loadSenloConfig } from "@senlo/core";
import { runSenloWorker } from "@senlo/core/queue";
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

runSenloWorker({
  config,
  repositories: createRepositories(createDb(config.databaseUrl), {
    secrets: aesGcmCipher(config.secretsKey),
  }),
  logger,
});
