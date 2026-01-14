import { eq, inArray, and, count } from "drizzle-orm";
import { db } from "../client";
import { recipientLists, recipientListContacts, contacts } from "../schema";
import { RecipientList, Contact } from "@senlo/core";
import { BaseRepository } from "./baseRepository";

/**
 * Repository for managing recipient lists (email segments).
 * Extends BaseRepository for common operations (findById, delete).
 */
export class RecipientListRepository extends BaseRepository<
  typeof recipientLists,
  typeof recipientLists.$inferSelect,
  RecipientList
> {
  protected table = recipientLists;

  /**
   * Map a database row to a RecipientList entity.
   * @param row - The raw database row
   * @returns The mapped RecipientList
   */
  protected mapToEntity(row: typeof recipientLists.$inferSelect): RecipientList {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      description: row.description ?? null,
      createdAt: row.createdAt,
    };
  }

  /**
   * Get all recipient lists for a project.
   * @param projectId - The project ID
   * @returns Array of recipient lists
   */
  async findByProject(projectId: number): Promise<RecipientList[]> {
    const rows = await db
      .select()
      .from(recipientLists)
      .where(eq(recipientLists.projectId, projectId));

    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Create a new recipient list.
   * @param data - List data including projectId, name, and optional description
   * @returns The created list
   */
  async create(data: {
    projectId: number;
    name: string;
    description?: string | null;
  }): Promise<RecipientList> {
    const [row] = await db
      .insert(recipientLists)
      .values({
        projectId: data.projectId,
        name: data.name,
        description: data.description,
        createdAt: new Date(),
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Add contacts to a recipient list.
   * @param listId - The list ID
   * @param contactIds - Array of contact IDs to add
   */
  async addContacts(listId: number, contactIds: number[]): Promise<void> {
    if (contactIds.length === 0) return;

    const values = contactIds.map((contactId) => ({
      listId,
      contactId,
    }));

    await db.insert(recipientListContacts).values(values).onConflictDoNothing();
  }

  /**
   * Remove contacts from a recipient list.
   * @param listId - The list ID
   * @param contactIds - Array of contact IDs to remove
   */
  async removeContacts(listId: number, contactIds: number[]): Promise<void> {
    if (contactIds.length === 0) return;

    await db
      .delete(recipientListContacts)
      .where(
        and(
          eq(recipientListContacts.listId, listId),
          inArray(recipientListContacts.contactId, contactIds)
        )
      );
  }

  /**
   * Get all contacts in a recipient list.
   * @param listId - The list ID
   * @param onlyActive - If true, excludes unsubscribed contacts (default: true)
   * @returns Array of contacts
   */
  async getContacts(
    listId: number,
    onlyActive: boolean = true
  ): Promise<Contact[]> {
    const conditions = [eq(recipientListContacts.listId, listId)];

    if (onlyActive) {
      conditions.push(eq(contacts.unsubscribed, false));
    }

    const rows = await db
      .select({
        id: contacts.id,
        projectId: contacts.projectId,
        email: contacts.email,
        name: contacts.name,
        meta: contacts.meta,
        unsubscribed: contacts.unsubscribed,
        unsubscribedAt: contacts.unsubscribedAt,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(
        recipientListContacts,
        eq(contacts.id, recipientListContacts.contactId)
      )
      .where(and(...conditions));

    return rows.map((row) => ({
      ...row,
      meta: row.meta as Record<string, any> | null,
    }));
  }

  /**
   * Get the number of contacts in a recipient list.
   * @param listId - The list ID
   * @returns The contact count
   */
  async getContactCount(listId: number): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(recipientListContacts)
      .where(eq(recipientListContacts.listId, listId));

    return result?.count ?? 0;
  }

  /**
   * Get or create a default list for a project.
   * @param projectId - The project ID
   * @returns The default list (creates one if none exists)
   */
  async getDefaultList(projectId: number): Promise<RecipientList> {
    const lists = await this.findByProject(projectId);
    if (lists.length > 0) return lists[0];

    return this.create({
      projectId,
      name: "Default List",
      description: "Automatically created default list",
    });
  }
}
