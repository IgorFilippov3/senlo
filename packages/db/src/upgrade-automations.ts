// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// CLI: brings automations to the current shape. Idempotent: the deploy start
// scripts run it on every start, a no-op once done.
//   pnpm db:upgrade-automations --before-push   before `db:push`: fixes rows the
//                                               new unique indexes would refuse
//   pnpm db:upgrade-automations                 after `db:push`: versions, steps,
//                                               old runs (`upgradeAutomations`)
import { prepareAutomationsForPush, upgradeAutomations } from "./automations-upgrade";
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
  if (process.argv.includes("--before-push")) {
    const fixed = await prepareAutomationsForPush(db);
    if (fixed.duplicateRunsCancelled > 0) console.log(`automations: cancelled ${fixed.duplicateRunsCancelled} duplicate running run(s)`);
    if (fixed.duplicateStepsDeleted > 0) console.log(`automations: deleted ${fixed.duplicateStepsDeleted} duplicate step row(s)`);
    process.exit(0);
  }
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
