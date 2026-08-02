import { eq, desc } from "drizzle-orm";
import { emailProviders } from "../schema";
import { EmailProvider } from "@senlo/core";
import { BaseRepositoryWithTimestamps } from "./baseRepository";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

/**
 * Repository for managing email providers (Resend, Mailgun, etc.).
 * Extends BaseRepositoryWithTimestamps for common CRUD operations.
 */
export class EmailProviderRepository extends BaseRepositoryWithTimestamps<
  typeof emailProviders,
  typeof emailProviders.$inferSelect,
  EmailProvider
> {
  protected table = emailProviders;

  constructor(db: NodePgDatabase<typeof schema>) {
    super(db);
  }


  /**
   * Map a database row to an EmailProvider entity.
   * @param row - The raw database row
   * @returns The mapped EmailProvider
   */
  protected mapToEntity(row: typeof emailProviders.$inferSelect): EmailProvider {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      type: row.type,
      config: row.config as Record<string, any>,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Find providers by user ID.
   * @param userId - The user ID
   * @returns Array of providers belonging to the user
   */
  async findByUser(userId: string): Promise<EmailProvider[]> {
    const rows = await this.db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.userId, userId))
      .orderBy(desc(emailProviders.createdAt));

    return rows.map((row) => this.mapToEntity(row));
  }

  /**
   * @deprecated Use project.providerId instead. Providers are now selected at the project level.
   * This method will be removed in a future version.
   */
  async findActive(): Promise<EmailProvider | null> {
    const [row] = await this.db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.isActive, true))
      .limit(1);

    return row ? this.mapToEntity(row) : null;
  }

  /**
   * Create a new email provider.
   * @param data - Provider data including name, type, userId and config
   * @returns The created provider
   */
  async create(
    data: Omit<EmailProvider, "id" | "createdAt" | "updatedAt">
  ): Promise<EmailProvider> {
    const [row] = await this.db
      .insert(emailProviders)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Update a provider by ID.
   * @param id - The provider ID
   * @param data - Fields to update
   * @returns The updated provider or null if not found
   */
  async update(
    id: number,
    data: Partial<Omit<EmailProvider, "id" | "createdAt" | "updatedAt">>
  ): Promise<EmailProvider | null> {
    const [row] = await this.db
      .update(emailProviders)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(emailProviders.id, id))
      .returning();

    return row ? this.mapToEntity(row) : null;
  }
}
