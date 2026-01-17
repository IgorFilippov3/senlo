import { eq, desc, and } from "drizzle-orm";
import { db } from "../client";
import { savedRows } from "../schema";
import { SavedRow } from "@senlo/core";
import { BaseRepositoryWithTimestamps } from "./baseRepository";

/**
 * Repository for managing saved email rows.
 * Allows users to store and reuse custom row layouts.
 */
export class SavedRowRepository extends BaseRepositoryWithTimestamps<
  typeof savedRows,
  typeof savedRows.$inferSelect,
  SavedRow
> {
  protected table = savedRows;

  /**
   * Map a database row to a SavedRow entity.
   */
  protected mapToEntity(row: typeof savedRows.$inferSelect): SavedRow {
    return {
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      name: row.name,
      data: row.data,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Get all saved rows for a specific user.
   * @param userId - The ID of the user
   * @returns Array of saved rows ordered by creation date
   */
  async findByUser(userId: string): Promise<SavedRow[]> {
    const rows = await db
      .select()
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .orderBy(desc(this.table.createdAt));

    return rows.map((r) => this.mapToEntity(r));
  }

  /**
   * Create a new saved row.
   * @param data - Saved row data
   * @returns The created SavedRow
   */
  async create(
    data: Omit<typeof savedRows.$inferInsert, "id" | "createdAt" | "updatedAt">,
  ): Promise<SavedRow> {
    const [row] = await db
      .insert(this.table)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Update a saved row.
   */
  async update(
    id: number,
    data: Partial<
      Omit<
        typeof savedRows.$inferInsert,
        "id" | "userId" | "createdAt" | "updatedAt"
      >
    >,
  ): Promise<SavedRow | null> {
    const [row] = await db
      .update(this.table)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(this.table.id, id))
      .returning();

    return row ? this.mapToEntity(row) : null;
  }
}
