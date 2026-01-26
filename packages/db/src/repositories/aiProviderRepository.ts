import { eq, desc } from "drizzle-orm";
import { db } from "../client";
import { aiProviders } from "../schema";
import { AiProvider } from "@senlo/core";
import { BaseRepositoryWithTimestamps } from "./baseRepository";

/**
 * Repository for managing AI providers (OpenAI, Anthropic, etc.).
 * Extends BaseRepositoryWithTimestamps for common CRUD operations.
 */
export class AiProviderRepository extends BaseRepositoryWithTimestamps<
  typeof aiProviders,
  typeof aiProviders.$inferSelect,
  AiProvider
> {
  protected table = aiProviders;

  /**
   * Map a database row to an AiProvider entity.
   * @param row - The raw database row
   * @returns The mapped AiProvider
   */
  protected mapToEntity(row: typeof aiProviders.$inferSelect): AiProvider {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      type: row.type as "OPENAI" | "ANTHROPIC",
      config: row.config as Record<string, any>,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Find providers by user ID.
   * @param userId - The user ID
   * @returns Array of AI providers belonging to the user
   */
  async findByUser(userId: string): Promise<AiProvider[]> {
    const rows = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.userId, userId))
      .orderBy(desc(aiProviders.createdAt));

    return rows.map((row) => this.mapToEntity(row));
  }

  /**
   * Find the active AI provider.
   * @returns The active AI provider or null if not found
   */
  async findActive(): Promise<AiProvider | null> {
    const [row] = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.isActive, true))
      .limit(1);

    return row ? this.mapToEntity(row) : null;
  }

  /**
   * Create a new AI provider.
   * @param data - Provider data including name, type, userId and config
   * @returns The created provider
   */
  async create(
    data: Omit<AiProvider, "id" | "createdAt" | "updatedAt">,
  ): Promise<AiProvider> {
    const [row] = await db
      .insert(aiProviders)
      .values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Update an AI provider by ID.
   * @param id - The provider ID
   * @param data - Fields to update
   * @returns The updated provider or null if not found
   */
  async update(
    id: number,
    data: Partial<Omit<AiProvider, "id" | "createdAt" | "updatedAt">>,
  ): Promise<AiProvider | null> {
    const [row] = await db
      .update(aiProviders)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, id))
      .returning();

    return row ? this.mapToEntity(row) : null;
  }
}
