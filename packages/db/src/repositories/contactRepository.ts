import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { contacts } from "../schema";
import type { Contact } from "@senlo/core";
import { BaseRepository } from "./baseRepository";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

/**
 * Repository for managing contacts (email subscribers) in the database.
 * Extends BaseRepository for common operations (findById, delete).
 */
export class ContactRepository extends BaseRepository<
  typeof contacts,
  typeof contacts.$inferSelect,
  Contact
> {
  protected table = contacts;

  constructor(db: NodePgDatabase<typeof schema>) {
    super(db);
  }


  /**
   * Map a database row to a Contact entity.
   * @param row - The raw database row
   * @returns The mapped Contact
   */
  protected mapToEntity(row: typeof contacts.$inferSelect): Contact {
    return {
      id: row.id,
      projectId: row.projectId,
      email: row.email,
      name: row.name,
      meta: row.meta as Record<string, any> | null,
      unsubscribed: row.unsubscribed,
      unsubscribedAt: row.unsubscribedAt,
      createdAt: row.createdAt,
    };
  }

  /**
   * Get all contacts for a project, ordered by creation date (newest first).
   * @param projectId - The project ID
   * @returns Array of contacts
   */
  async findByProject(projectId: number): Promise<Contact[]> {
    const rows = await this.db
      .select()
      .from(contacts)
      .where(eq(contacts.projectId, projectId))
      .orderBy(desc(contacts.createdAt));

    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Find a contact by email within a project.
   * @param projectId - The project ID
   * @param email - The email address
   * @returns The contact or null if not found
   */
  async findByEmail(projectId: number, email: string): Promise<Contact | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.projectId, projectId), eq(contacts.email, email)));

    return row ? this.mapToEntity(row) : null;
  }

  /**
   * Create a new contact.
   * @param data - Contact data including projectId, email, and optional name/meta
   * @returns The created contact
   */
  async create(data: {
    projectId: number;
    email: string;
    name?: string | null;
    meta?: Record<string, any> | null;
  }): Promise<Contact> {
    const [row] = await this.db
      .insert(contacts)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Insert or update a contact. Updates name/meta if contact already exists.
   * @param data - Contact data
   * @returns The upserted contact
   */
  async upsert(data: {
    projectId: number;
    email: string;
    name?: string | null;
    meta?: Record<string, any> | null;
  }): Promise<Contact> {
    const [row] = await this.db
      .insert(contacts)
      .values({
        ...data,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [contacts.projectId, contacts.email],
        set: {
          name: data.name ?? sql`${contacts.name}`,
          meta: data.meta ?? sql`${contacts.meta}`,
        },
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Batch insert or update contacts. Efficient for importing large datasets.
   * @param projectId - The project ID
   * @param items - Array of contact data
   * @returns Array of upserted contacts
   */
  async batchUpsert(
    projectId: number,
    items: { email: string; name?: string; meta?: any }[]
  ): Promise<Contact[]> {
    if (items.length === 0) return [];

    const values = items.map((item) => ({
      projectId,
      email: item.email,
      name: item.name,
      meta: item.meta,
      createdAt: new Date(),
    }));

    const rows = await this.db
      .insert(contacts)
      .values(values)
      .onConflictDoUpdate({
        target: [contacts.projectId, contacts.email],
        set: {
          name: sql`EXCLUDED.name`,
          meta: sql`EXCLUDED.meta`,
        },
      })
      .returning();

    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Find contacts by a list of email addresses.
   * @param projectId - The project ID
   * @param emails - Array of email addresses
   * @returns Array of matching contacts
   */
  async findByEmails(projectId: number, emails: string[]): Promise<Contact[]> {
    if (emails.length === 0) return [];
    const rows = await this.db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.projectId, projectId), inArray(contacts.email, emails))
      );
    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Mark a contact as unsubscribed by email and project.
   * @param projectId - The project ID
   * @param email - The email address
   */
  async unsubscribeByEmail(projectId: number, email: string): Promise<void> {
    await this.db
      .update(contacts)
      .set({
        unsubscribed: true,
        unsubscribedAt: new Date(),
      })
      .where(and(eq(contacts.projectId, projectId), eq(contacts.email, email)));
  }

  /**
   * Mark a contact as unsubscribed.
   * @param id - The contact ID
   */
  async unsubscribe(id: number): Promise<void> {
    await this.db
      .update(contacts)
      .set({
        unsubscribed: true,
        unsubscribedAt: new Date(),
      })
      .where(eq(contacts.id, id));
  }
}
