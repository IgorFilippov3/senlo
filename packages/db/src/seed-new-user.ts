// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { eq } from "drizzle-orm";
import { db } from "./client";
import { projects } from "./schema";
import { seedUserData } from "./user-seed";

/**
 * Fills a newly created account with the example project and starter
 * templates (`seedUserData`), so nobody lands in an empty dashboard.
 *
 * Both registration paths reach this function, the credentials flow directly
 * and GitHub through the adapter's `createUser` event, and so does
 * `provision.ts` for `INITIAL_USERS`. It is safe to call more than once: an
 * account that already owns a project is left alone, which also keeps
 * existing accounts out of it.
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

  try {
    await seedUserData(userId);
  } catch (error) {
    // The seed is not a transaction and writes the project first. A failure
    // part-way would leave a project behind, which the guard above would read
    // as "already seeded" on any later call. Roll back to empty instead.
    await db.delete(projects).where(eq(projects.userId, userId));
    throw error;
  }
}
