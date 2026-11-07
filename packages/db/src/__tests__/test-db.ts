// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import type { Database } from "../client";
import * as schema from "../schema";

/**
 * A real Postgres (PGlite, in memory) with the current schema pushed, as
 * `pnpm db:push` would. The repositories are typed for node-postgres; the
 * PGlite driver speaks the same query builder and returns rows the same way.
 */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const { apply } = await pushSchema(schema, db as any);
  await apply();
  return { db: db as unknown as Database, close: () => client.close() };
}

/** A user, a project, a template and a TRIGGERED campaign; ids returned. */
export async function seedCampaign(db: Database, type: "TRIGGERED" | "STANDARD" = "TRIGGERED") {
  const userId = `user-${Math.random().toString(36).slice(2)}`;
  await db.insert(schema.users).values({ id: userId, email: `${userId}@example.com` });
  const [project] = await db.insert(schema.projects).values({ userId, name: "Project" }).returning();
  const [template] = await db
    .insert(schema.emailTemplates)
    .values({ projectId: project.id, name: "Template", subject: "Hi", html: "<p>Hi</p>" })
    .returning();
  const [campaign] = await db
    .insert(schema.campaigns)
    .values({ projectId: project.id, name: "Campaign", type, templateId: template.id })
    .returning();
  return { projectId: project.id, campaignId: campaign.id };
}
