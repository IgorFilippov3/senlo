// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { and, asc, eq } from "drizzle-orm";
import { db } from "./client";
import { projects, users } from "./schema";
import { DEMO_PROJECT_NAME, seedDemoData } from "./demo-seed";

/**
 * Fills an account with demo data for screenshots and the public demo instance.
 *
 *   pnpm db:seed:demo                          # first user in the database
 *   DEMO_USER_EMAIL=me@example.com pnpm db:seed:demo
 *   DEMO_RESET=true pnpm db:seed:demo          # replace existing demo project
 *
 * The analytics this creates are invented. Do not run it against an instance
 * where anyone would read those numbers as their own sending history.
 */
async function main() {
  const email = process.env.DEMO_USER_EMAIL;

  const [user] = email
    ? await db.select().from(users).where(eq(users.email, email))
    : await db.select().from(users).orderBy(asc(users.id)).limit(1);

  if (!user) {
    console.error(
      email
        ? `No user found with email ${email}.`
        : "No users in the database. Register once, then run this again.",
    );
    process.exit(1);
  }

  const [existing] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.userId, user.id), eq(projects.name, DEMO_PROJECT_NAME)),
    );

  if (existing) {
    if (process.env.DEMO_RESET !== "true") {
      console.error(
        `User ${user.email} already has a "${DEMO_PROJECT_NAME}" project.\n` +
          "Re-run with DEMO_RESET=true to delete it and seed a fresh copy.",
      );
      process.exit(1);
    }

    console.log(`Removing the existing "${DEMO_PROJECT_NAME}" project...`);
    // Templates, campaigns, contacts, workflows and events all cascade.
    await db.delete(projects).where(eq(projects.id, existing.id));
  }

  console.log(`Seeding demo data for ${user.email}...`);

  const { project, apiKey, contactCount } = await seedDemoData(user.id);

  console.log("");
  console.log(`  Project    ${project.name} (id ${project.id})`);
  console.log(`  Contacts   ${contactCount}`);
  console.log(`  API key    ${apiKey.key}`);
  console.log("");
  console.log("Done. The demo email provider holds a placeholder credential —");
  console.log("sending from this project will fail until you replace it.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo seeding failed:", error);
    process.exit(1);
  });
