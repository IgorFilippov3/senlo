// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type {
  EmailDesignDocument,
  EmailTemplateVersion,
  EmailTemplateVersionSummary,
  ITemplateVersionRepository,
  NewEmailTemplateVersion,
  TemplateVersionAuthor,
  TemplateVersionSource,
} from "@senlo/core";
import * as schema from "../schema";
import { apiKeys, emailTemplateVersions, users } from "../schema";

type VersionRow = typeof emailTemplateVersions.$inferSelect;
type AuthorColumns = {
  userName: string | null;
  userEmail: string | null;
  apiKeyName: string | null;
  apiKeyPrefix: string | null;
};

/** A template's version history, with who saved each version. */
export class TemplateVersionRepository implements ITemplateVersionRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  private author(row: VersionRow, a: AuthorColumns): TemplateVersionAuthor {
    if (row.createdByUserId && a.userEmail) {
      return { kind: "user", userId: row.createdByUserId, name: a.userName, email: a.userEmail };
    }
    if (row.createdByApiKeyId && a.apiKeyName) {
      return { kind: "apiKey", apiKeyId: row.createdByApiKeyId, name: a.apiKeyName, prefix: a.apiKeyPrefix ?? "" };
    }
    return null;
  }

  private summary(row: VersionRow, a: AuthorColumns): EmailTemplateVersionSummary {
    return {
      id: row.id,
      templateId: row.templateId,
      version: row.version,
      subject: row.subject,
      preheader: row.preheader,
      source: row.source as TemplateVersionSource,
      author: this.author(row, a),
      createdAt: row.createdAt,
    };
  }

  /** Versions with their author's name, joined from users and API keys. */
  private selectWithAuthor() {
    return this.db
      .select({
        row: emailTemplateVersions,
        userName: users.name,
        userEmail: users.email,
        apiKeyName: apiKeys.name,
        apiKeyPrefix: apiKeys.prefix,
      })
      .from(emailTemplateVersions)
      .leftJoin(users, eq(users.id, emailTemplateVersions.createdByUserId))
      .leftJoin(apiKeys, eq(apiKeys.id, emailTemplateVersions.createdByApiKeyId));
  }

  private full(r: { row: VersionRow } & AuthorColumns): EmailTemplateVersion {
    return { ...this.summary(r.row, r), design: r.row.design as EmailDesignDocument };
  }

  async latest(templateId: number): Promise<EmailTemplateVersion | null> {
    const [r] = await this.selectWithAuthor()
      .where(eq(emailTemplateVersions.templateId, templateId))
      .orderBy(desc(emailTemplateVersions.version))
      .limit(1);
    return r ? this.full(r) : null;
  }

  async append(data: NewEmailTemplateVersion): Promise<EmailTemplateVersion> {
    // The number is taken in the same statement; two saves at once collide on
    // the unique (template, version) instead of sharing a number.
    const [row] = await this.db
      .insert(emailTemplateVersions)
      .values({
        templateId: data.templateId,
        version: sql`(SELECT COALESCE(MAX(${emailTemplateVersions.version}), 0) + 1 FROM ${emailTemplateVersions} WHERE ${emailTemplateVersions.templateId} = ${data.templateId})`,
        design: data.design,
        subject: data.subject,
        preheader: data.preheader,
        source: data.source,
        createdByUserId: data.createdByUserId ?? null,
        createdByApiKeyId: data.createdByApiKeyId ?? null,
      })
      .returning();
    return (await this.findById(row.id))!;
  }

  async listByTemplate(templateId: number, limit: number): Promise<EmailTemplateVersionSummary[]> {
    const rows = await this.selectWithAuthor()
      .where(eq(emailTemplateVersions.templateId, templateId))
      .orderBy(desc(emailTemplateVersions.version))
      .limit(limit);
    return rows.map((r) => this.summary(r.row, r));
  }

  async findById(id: number): Promise<EmailTemplateVersion | null> {
    const [r] = await this.selectWithAuthor().where(eq(emailTemplateVersions.id, id));
    return r ? this.full(r) : null;
  }
}
