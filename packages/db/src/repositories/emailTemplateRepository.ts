import { eq } from "drizzle-orm";
import { db } from "../client";
import { emailTemplates } from "../schema";
import {
  EmailTemplate,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  EmailTemplateStatus,
} from "@senlo/core";
import { BaseRepository } from "./baseRepository";

/**
 * Repository for managing email templates.
 * Extends BaseRepository for common operations (findById, delete).
 */
export class EmailTemplateRepository extends BaseRepository<
  typeof emailTemplates,
  typeof emailTemplates.$inferSelect,
  EmailTemplate
> {
  protected table = emailTemplates;

  /**
   * Map a database row to an EmailTemplate entity.
   * @param row - The raw database row
   * @returns The mapped EmailTemplate
   */
  protected mapToEntity(row: typeof emailTemplates.$inferSelect): EmailTemplate {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      subject: row.subject,
      html: row.html,
      designJson: (row.designJson as EmailTemplate["designJson"]) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      status: row.status as EmailTemplateStatus,
    };
  }

  /**
   * Get all templates for a project, ordered by creation date.
   * @param projectId - The project ID
   * @returns Array of templates
   */
  async findByProject(projectId: number): Promise<EmailTemplate[]> {
    const rows = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.projectId, projectId))
      .orderBy(emailTemplates.createdAt);

    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Create a new email template.
   * @param input - Template data including projectId, name, subject, html, and optional designJson
   * @returns The created template
   */
  async create(input: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const now = new Date();

    const [row] = await db
      .insert(emailTemplates)
      .values({
        projectId: input.projectId,
        name: input.name,
        subject: input.subject,
        html: input.html,
        designJson: input.designJson ?? null,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Update an email template.
   * @param input - Update data including id and fields to update
   * @returns The updated template or null if not found
   */
  async update(input: UpdateEmailTemplateInput): Promise<EmailTemplate | null> {
    const set: Partial<typeof emailTemplates.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof input.name !== "undefined") set.name = input.name;
    if (typeof input.subject !== "undefined") set.subject = input.subject;
    if (typeof input.html !== "undefined") set.html = input.html;
    if (typeof input.designJson !== "undefined") {
      set.designJson = input.designJson;
    }
    if (typeof input.status !== "undefined") set.status = input.status;

    const [row] = await db
      .update(emailTemplates)
      .set(set)
      .where(eq(emailTemplates.id, input.id))
      .returning();

    return row ? this.mapToEntity(row) : null;
  }
}
