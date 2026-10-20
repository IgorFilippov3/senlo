// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// CLI: marks workflow executions stuck in RUNNING (e.g. after a worker crash)
// as FAILED. Run with `pnpm db:reset-executions`.
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { loadLocalEnv } from "./cli-env";
import * as schema from "./schema";

loadLocalEnv();
const db = createDb(process.env.DATABASE_URL!);

async function resetExecutions() {
  console.log("Resetting stuck executions...");

  const result = await db
    .update(schema.workflowExecutions)
    .set({ status: "FAILED", completedAt: new Date() })
    .where(eq(schema.workflowExecutions.status, "RUNNING"));

  console.log("Done! All RUNNING executions moved to FAILED.");
  process.exit(0);
}

resetExecutions().catch((err) => {
  console.error(err);
  process.exit(1);
});
