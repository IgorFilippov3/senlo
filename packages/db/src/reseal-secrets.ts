// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// CLI: seals provider configs written before secrets at rest, and re-seals
// everything when the key changes. Run with `pnpm db:reseal-secrets`.
//
//   pnpm db:reseal-secrets                 # plain rows → sealed with SECRETS_KEY
//   OLD_SECRETS_KEY=... pnpm db:reseal-secrets   # rows sealed with the old key → the current one
import { eq } from "drizzle-orm";
import {
  aesGcmCipher,
  ConfigError,
  isSealedEnvelope,
  loadSenloConfig,
  openConfig,
  sealConfig,
  type SecretCipher,
} from "@senlo/core";
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
const current = aesGcmCipher(config.secretsKey);
const previous: SecretCipher | null = process.env.OLD_SECRETS_KEY?.trim()
  ? aesGcmCipher(process.env.OLD_SECRETS_KEY.trim())
  : null;

/** Opens with the current key, then the old one when given; null when neither works. */
async function openWithAnyKey(stored: unknown): Promise<Record<string, unknown> | null> {
  for (const cipher of [current, previous]) {
    if (!cipher) continue;
    try {
      return await openConfig(cipher, stored);
    } catch {
      // try the next key
    }
  }
  return null;
}

async function resealTable(
  table: typeof schema.emailProviders | typeof schema.aiProviders,
  label: string,
) {
  const rows = await db.select({ id: table.id, config: table.config }).from(table);
  let sealed = 0;
  let kept = 0;
  const failed: number[] = [];
  for (const row of rows) {
    const sealedWithCurrent =
      isSealedEnvelope(row.config) && (await current.open(row.config.$sealed)) !== null;
    if (sealedWithCurrent) {
      kept++;
      continue;
    }
    const plain = await openWithAnyKey(row.config);
    if (!plain) {
      failed.push(row.id);
      continue;
    }
    await db
      .update(table)
      .set({ config: await sealConfig(current, plain) })
      .where(eq(table.id, row.id));
    sealed++;
  }
  console.log(`${label}: ${sealed} sealed, ${kept} already current${failed.length ? `, ${failed.length} unreadable (ids ${failed.join(", ")})` : ""}`);
  return failed.length;
}

async function main() {
  const failures =
    (await resealTable(schema.emailProviders, "email_providers")) +
    (await resealTable(schema.aiProviders, "ai_providers"));
  if (failures > 0) {
    console.error(
      "Some rows could not be opened with SECRETS_KEY or OLD_SECRETS_KEY. Set OLD_SECRETS_KEY to the key they were sealed with and run again.",
    );
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
