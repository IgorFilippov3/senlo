import { createDb } from "@senlo/db";
import { loadLocalEnv } from "@senlo/db/src/cli-env";
import { eq } from "drizzle-orm";
import * as schema from "@senlo/db/src/schema";

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
