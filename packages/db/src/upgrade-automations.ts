// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// CLI: brings automations from before workflow versions to the current shape
// (`upgradeAutomations`): `pnpm db:upgrade-automations`, after `pnpm db:push`.
// Idempotent: the deploy start scripts run it on every start, a no-op once done.
import { upgradeAutomations } from "./automations-upgrade";
import { createDb } from "./client";
import { loadLocalEnv } from "./cli-env";

loadLocalEnv();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = createDb(databaseUrl);

async function main() {
  const result = await upgradeAutomations(db, { log: (message) => console.log(message) });
  if (result.cancelledRuns + result.nodesRewritten + result.versionsCreated === 0) {
    console.log("automations: up to date, nothing to do");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
