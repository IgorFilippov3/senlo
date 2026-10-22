import { and, eq, desc, isNull } from "drizzle-orm";
import { aiProviders } from "../schema";
import { openConfigOrFlag, sealConfig, type AiProvider, type SecretCipher } from "@senlo/core";
import { BaseRepositoryWithTimestamps } from "./baseRepository";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

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
   * @param secrets - Seals `config` on write and opens it on read, so the
   * column holds credentials encrypted while callers see them plain.
   */
  constructor(
    db: NodePgDatabase<typeof schema>,
    private readonly secrets: SecretCipher,
  ) {
    super(db);
  }


  /**
   * Map a database row to an AiProvider entity.
   * @param row - The raw database row
   * @returns The mapped AiProvider
   */
  protected mapToEntity(row: typeof aiProviders.$inferSelect): AiProvider {
    return {
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      name: row.name,
      type: row.type as "OPENAI" | "ANTHROPIC",
      // Sealed in the row; `toEntity` opens it. Never returned as is.
      config: {},
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** The entity with its config opened (sealed envelope or a legacy plain row). */
  private async toEntity(row: typeof aiProviders.$inferSelect): Promise<AiProvider> {
    // A row sealed with another key is flagged rather than thrown: a list
    // shows it as needing new credentials, and senders refuse it.
    const { config, unreadable } = await openConfigOrFlag(this.secrets, row.config);
    return { ...this.mapToEntity(row), config, ...(unreadable ? { configUnreadable: true } : {}) };
  }

  async findById(id: number): Promise<AiProvider | null> {
    const [row] = await this.db.select().from(aiProviders).where(eq(aiProviders.id, id));
    return row ? this.toEntity(row) : null;
  }

  async findAll(): Promise<AiProvider[]> {
    const rows = await this.db.select().from(aiProviders).orderBy(desc(aiProviders.createdAt));
    return Promise.all(rows.map((row) => this.toEntity(row)));
  }

  /** AI providers the user owns personally, newest first. */
  async listForUser(userId: string): Promise<AiProvider[]> {
    const rows = await this.db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.userId, userId), isNull(aiProviders.organizationId)))
      .orderBy(desc(aiProviders.createdAt));

    return Promise.all(rows.map((row) => this.toEntity(row)));
  }

  /** AI providers the organization owns, newest first. */
  async listForOrganization(organizationId: string): Promise<AiProvider[]> {
    const rows = await this.db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.organizationId, organizationId))
      .orderBy(desc(aiProviders.createdAt));

    return Promise.all(rows.map((row) => this.toEntity(row)));
  }

  /**
   * Find the active AI provider.
   * @returns The active AI provider or null if not found
   */
  async findActive(): Promise<AiProvider | null> {
    const [row] = await this.db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.isActive, true))
      .limit(1);

    return row ? this.toEntity(row) : null;
  }

  /**
   * Create a new AI provider.
   * @param data - Provider data including name, type, userId and config
   * @returns The created provider
   */
  async create(
    data: Omit<AiProvider, "id" | "createdAt" | "updatedAt">,
  ): Promise<AiProvider> {
    const [row] = await this.db
      .insert(aiProviders)
      .values({
        ...data,
        config: await sealConfig(this.secrets, data.config),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.toEntity(row);
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
    const [row] = await this.db
      .update(aiProviders)
      .set({
        ...data,
        ...(data.config ? { config: await sealConfig(this.secrets, data.config) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, id))
      .returning();

    return row ? this.toEntity(row) : null;
  }
}
