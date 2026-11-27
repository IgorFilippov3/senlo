// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { EmailDesignDocument } from "@senlo/core";
import type { Database } from "../client";
import * as schema from "../schema";
import { TemplateVersionRepository } from "../repositories/templateVersionRepository";
import { createTestDb } from "./test-db";

let db: Database;
let close: () => Promise<void>;
let versions: TemplateVersionRepository;
let templateId: number;
let otherTemplateId: number;
let apiKeyId: number;

const design = (id: string) => ({ rows: [{ id }] }) as unknown as EmailDesignDocument;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  versions = new TemplateVersionRepository(db);
  await db.insert(schema.users).values({ id: "alice", name: "Alice", email: "alice@x.io" });
  const [project] = await db.insert(schema.projects).values({ name: "P" }).returning();
  const [t1, t2] = await db
    .insert(schema.emailTemplates)
    .values([
      { projectId: project.id, name: "A", subject: "a", html: "" },
      { projectId: project.id, name: "B", subject: "b", html: "" },
    ])
    .returning();
  templateId = t1.id;
  otherTemplateId = t2.id;
  const [key] = await db
    .insert(schema.apiKeys)
    .values({ projectId: project.id, name: "agent", keyHash: "h", prefix: "snl_aaaaaaaa", permissions: ["manage"] })
    .returning();
  apiKeyId = key.id;
});

afterEach(async () => {
  await close();
});

describe("TemplateVersionRepository", () => {
  it("numbers versions per template and returns the newest as latest", async () => {
    expect(await versions.latest(templateId)).toBeNull();

    const v1 = await versions.append({ templateId, design: design("1"), subject: "s1", preheader: null, source: "baseline" });
    const v2 = await versions.append({
      templateId,
      design: design("2"),
      subject: "s2",
      preheader: "p",
      source: "editor",
      createdByUserId: "alice",
    });
    const other = await versions.append({ templateId: otherTemplateId, design: design("x"), subject: "x", preheader: null, source: "editor" });

    expect([v1.version, v2.version, other.version]).toEqual([1, 2, 1]);
    const latest = await versions.latest(templateId);
    expect(latest).toMatchObject({ id: v2.id, version: 2, subject: "s2", preheader: "p", source: "editor" });
    expect(latest?.design).toEqual(design("2"));
  });

  it("names the author: a user, an API key, or nobody", async () => {
    await versions.append({ templateId, design: design("1"), subject: "s", preheader: null, source: "baseline" });
    await versions.append({ templateId, design: design("2"), subject: "s", preheader: null, source: "editor", createdByUserId: "alice" });
    await versions.append({ templateId, design: design("3"), subject: "s", preheader: null, source: "mcp", createdByApiKeyId: apiKeyId });

    const list = await versions.listByTemplate(templateId, 10);
    expect(list.map((v) => [v.version, v.source, v.author])).toEqual([
      [3, "mcp", { kind: "apiKey", apiKeyId, name: "agent", prefix: "snl_aaaaaaaa" }],
      [2, "editor", { kind: "user", userId: "alice", name: "Alice", email: "alice@x.io" }],
      [1, "baseline", null],
    ]);
    expect(list[0]).not.toHaveProperty("design");
  });

  it("keeps a version when its author is deleted, and limits the list", async () => {
    await versions.append({ templateId, design: design("1"), subject: "s", preheader: null, source: "editor", createdByUserId: "alice" });
    await versions.append({ templateId, design: design("2"), subject: "s", preheader: null, source: "api", createdByApiKeyId: apiKeyId });
    await db.delete(schema.users).where(eq(schema.users.id, "alice"));
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, apiKeyId));

    const list = await versions.listByTemplate(templateId, 10);
    expect(list.map((v) => v.author)).toEqual([null, null]);
    expect(await versions.listByTemplate(templateId, 1)).toHaveLength(1);
  });

  it("goes with its template", async () => {
    const v = await versions.append({ templateId, design: design("1"), subject: "s", preheader: null, source: "editor" });
    await db.delete(schema.emailTemplates).where(eq(schema.emailTemplates.id, templateId));
    expect(await versions.findById(v.id)).toBeNull();
  });
});

describe("EmailTemplateRepository.findPageByProject", () => {
  it("pages a project's templates newest first, below an id", async () => {
    const { EmailTemplateRepository } = await import("../repositories/emailTemplateRepository");
    const templates = new EmailTemplateRepository(db);
    const ids = [templateId, otherTemplateId].sort((a, b) => b - a);
    const projectId = (await templates.findById(templateId))!.projectId;

    expect((await templates.findPageByProject(projectId, 10, null)).map((t) => t.id)).toEqual(ids);
    expect((await templates.findPageByProject(projectId, 1, null)).map((t) => t.id)).toEqual([ids[0]]);
    expect((await templates.findPageByProject(projectId, 10, ids[0])).map((t) => t.id)).toEqual([ids[1]]);
    expect(await templates.findPageByProject(999, 10, null)).toEqual([]);
  });
});

describe("CampaignRepository.findTriggeredPage", () => {
  it("pages a project's triggers only, newest first", async () => {
    const { CampaignRepository } = await import("../repositories/campaignRepository");
    const campaigns = new CampaignRepository(db);
    const projectId = (await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, templateId)))[0].projectId;
    const make = (name: string, type: "TRIGGERED" | "STANDARD") =>
      campaigns.create({ name, projectId, templateId, type, status: "DRAFT", listId: null } as never);
    const a = await make("a", "TRIGGERED");
    await make("legacy", "STANDARD");
    const b = await make("b", "TRIGGERED");

    expect((await campaigns.findTriggeredPage(projectId, 10, null)).map((c) => c.name)).toEqual(["b", "a"]);
    expect((await campaigns.findTriggeredPage(projectId, 1, null)).map((c) => c.id)).toEqual([b.id]);
    expect((await campaigns.findTriggeredPage(projectId, 10, b.id)).map((c) => c.id)).toEqual([a.id]);
  });
});

describe("WorkflowRepository.findPageByProject", () => {
  it("pages a project's workflows newest first", async () => {
    const { WorkflowRepository } = await import("../repositories/workflowRepository");
    const workflows = new WorkflowRepository(db);
    const projectId = (await db.select().from(schema.emailTemplates).where(eq(schema.emailTemplates.id, templateId)))[0].projectId;
    const a = await workflows.create({ projectId, name: "a", status: "DRAFT" });
    const b = await workflows.create({ projectId, name: "b", status: "DRAFT" });

    expect((await workflows.findPageByProject(projectId, 10, null)).map((w) => w.id)).toEqual([b.id, a.id]);
    expect((await workflows.findPageByProject(projectId, 10, b.id)).map((w) => w.id)).toEqual([a.id]);
    expect(await workflows.findPageByProject(projectId + 1000, 10, null)).toEqual([]);
  });
});
