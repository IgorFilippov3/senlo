// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderEmailDesign } from "@senlo/core";
import { db } from "./client";
import { emailTemplates, projects } from "./schema";
import { STARTER_TEMPLATES } from "./seeds/starter-templates";

/**
 * Gives a new account one example project with the starter templates, so the
 * editor has something real to open on the first visit. No provider, contacts
 * or sending history: nothing here pretends to be the user's own data.
 *
 * The stored `html` is rendered here the way the editor renders it on save.
 * Sending renders `designJson` again, so it only serves previews and lists;
 * `/logoipsum.png` and the social icons resolve against the app URL.
 */
export async function seedUserData(
  userId: string,
  options: { appUrl: string },
) {
  const [project] = await db
    .insert(projects)
    .values({
      userId,
      name: "Acme",
      description:
        "Example project with ready-made transactional emails. Open any template to see what the editor can do.",
    })
    .returning();

  const baseUrl = options.appUrl;

  await db.insert(emailTemplates).values(
    STARTER_TEMPLATES.map((template) => ({
      projectId: project.id,
      name: template.name,
      subject: template.subject,
      preheader: template.preheader,
      designJson: template.design,
      html: renderEmailDesign(template.design, {
        baseUrl,
        preheader: template.preheader,
        title: template.subject,
      }),
      status: "draft",
      locale: "en",
    })),
  );

  return project;
}
