// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// CLI: replaces API keys stored in the clear with their hash and prefix.
// Run once after `pnpm db:push` added the columns: `pnpm db:hash-api-keys`.
// Keys keep working throughout: bearer auth matches the plain column until a
// row is moved, and the hash after.
import { eq, isNotNull } from "drizzle-orm";
import { ConfigError, loadSenloConfig } from "@senlo/core";
import { apiKeyPrefix, hashApiKey } from "@senlo/core/server";
import { createDb } from "./client";
import { loadLocalEnv } from "./cli-env";
import * as schema from "./schema";

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
  const rows = await db
    .select({ id: schema.apiKeys.id, key: schema.apiKeys.key })
    .from(schema.apiKeys)
    .where(isNotNull(schema.apiKeys.key));

  for (const row of rows) {
    await db
      .update(schema.apiKeys)
      .set({ keyHash: hashApiKey(row.key!), prefix: apiKeyPrefix(row.key!), key: null })
      .where(eq(schema.apiKeys.id, row.id));
  }
  console.log(`api_keys: ${rows.length} moved to hashes`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
