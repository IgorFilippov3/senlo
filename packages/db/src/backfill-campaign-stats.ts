// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// CLI: fills `campaign_daily_stats` from the delivery log and the raw events,
// once, after `pnpm db:push` created the table: `pnpm db:backfill-stats`.
// Safe to run while the app and the worker run, and to run again: after the
// first complete run it does nothing. Log retention deletes nothing until it
// has run, so the deploy start scripts run it on every start.
import { backfillCampaignStats } from "./campaign-stats";
import { createDb } from "./client";
import { loadLocalEnv } from "./cli-env";

loadLocalEnv();

// Only the database: the whole app config (AUTH_SECRET and the rest) is not
// needed here, and a checkout's root .env, which `loadLocalEnv` finds first,
// holds DATABASE_URL alone (for drizzle-kit).
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = createDb(databaseUrl);

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
