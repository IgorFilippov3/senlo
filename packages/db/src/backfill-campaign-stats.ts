// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// CLI: fills `campaign_daily_stats` from the delivery log and the raw events,
// once, after `pnpm db:push` created the table: `pnpm db:backfill-stats`.
// Safe to run while the app and the worker run, and to run again: after the
// first complete run it does nothing. Log retention deletes nothing until it
// has run, so the deploy start scripts run it on every start.
import { ConfigError, loadSenloConfig } from "@senlo/core";
import { backfillCampaignStats } from "./campaign-stats";
import { createDb } from "./client";
import { loadLocalEnv } from "./cli-env";

loadLocalEnv();

let config: ReturnType<typeof loadSenloConfig>;
try {
  config = loadSenloConfig(process.env);
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
}

const db = createDb(config.databaseUrl);

async function main() {
  const result = await backfillCampaignStats(db, { log: (message) => console.log(message) });
  if (result.status === "already_done") {
    console.log("campaign_daily_stats: already backfilled, nothing to do");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
