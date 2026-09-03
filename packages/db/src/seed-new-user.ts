// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eq } from "drizzle-orm";
import { db } from "./client";
import { projects } from "./schema";
import { seedDemoData } from "./demo-seed";
import { seedUserData } from "./user-seed";

/**
 * Fills a newly created account so that nobody lands in an empty dashboard.
 *
 * Which seed runs depends on `IS_DEMO_MODE`:
 *
 * - On the public demo instance, the full `seedDemoData` — contacts, three
 *   automations and 30 days of delivery history. That history is invented,
 *   which is the entire point on a demo and a lie on anyone else's server, so
 *   this flag is what keeps it contained.
 * - Everywhere else, `seedUserData` — one project and four templates to open,
 *   and no fabricated sending history.
 *
 * Reading `IS_DEMO_MODE` rather than its `NEXT_PUBLIC_` twin is deliberate:
 * Next.js turns every `NEXT_PUBLIC_` read into a literal at build time, so the
 * prefixed name would decide this at build time instead of at startup.
 *
 * Safe to call more than once — an account that already owns a project is left
 * alone. Both registration paths reach this function, the credentials flow
 * directly and GitHub through the adapter's `createUser` event, and only one of
 * them should ever do the work.
 */
export async function seedNewUser(userId: string) {
  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId))
    .limit(1);

  if (existingProject) {
    return;
  }

  const seed =
    process.env.IS_DEMO_MODE === "true" ? seedDemoData : seedUserData;

  try {
    await seed(userId);
  } catch (error) {
    // Neither seed runs in a transaction, and both write the project first. A
    // failure part-way would therefore leave a project behind, which the guard
    // above would read on any later call as "already seeded" — freezing the
    // account half-populated for good. Roll back to empty, which is at least
    // a state the user can recover from by creating a project themselves.
    await db.delete(projects).where(eq(projects.userId, userId));
    throw error;
  }
}
