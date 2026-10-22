import { and, eq, desc, isNull } from "drizzle-orm";
import { emailProviders } from "../schema";
import { openConfigOrFlag, sealConfig, type EmailProvider, type SecretCipher } from "@senlo/core";
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
   * Map a database row to an EmailProvider entity.
   * @param row - The raw database row
   * @returns The mapped EmailProvider
   */
  protected mapToEntity(row: typeof emailProviders.$inferSelect): EmailProvider {
    return {
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      name: row.name,
      type: row.type,
      // Sealed in the row; `toEntity` opens it. Never returned as is.
      config: {},
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** The entity with its config opened (sealed envelope or a legacy plain row). */
  private async toEntity(row: typeof emailProviders.$inferSelect): Promise<EmailProvider> {
    // A row sealed with another key is flagged rather than thrown: a list
    // shows it as needing new credentials, and senders refuse it.
    const { config, unreadable } = await openConfigOrFlag(this.secrets, row.config);
    return { ...this.mapToEntity(row), config, ...(unreadable ? { configUnreadable: true } : {}) };
  }

  async findById(id: number): Promise<EmailProvider | null> {
    const [row] = await this.db.select().from(emailProviders).where(eq(emailProviders.id, id));
    return row ? this.toEntity(row) : null;
  }

  async findAll(): Promise<EmailProvider[]> {
    const rows = await this.db.select().from(emailProviders).orderBy(desc(emailProviders.createdAt));
    return Promise.all(rows.map((row) => this.toEntity(row)));
  }

  /** Providers the user owns personally, newest first. */
  async listForUser(userId: string): Promise<EmailProvider[]> {
    const rows = await this.db
      .select()
      .from(emailProviders)
      .where(and(eq(emailProviders.userId, userId), isNull(emailProviders.organizationId)))
      .orderBy(desc(emailProviders.createdAt));

    return Promise.all(rows.map((row) => this.toEntity(row)));
  }

  /** Providers the organization owns, newest first. */
  async listForOrganization(organizationId: string): Promise<EmailProvider[]> {
    const rows = await this.db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.organizationId, organizationId))
      .orderBy(desc(emailProviders.createdAt));

    return Promise.all(rows.map((row) => this.toEntity(row)));
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

    return row ? this.toEntity(row) : null;
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
        config: await sealConfig(this.secrets, data.config),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.toEntity(row);
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
        ...(data.config ? { config: await sealConfig(this.secrets, data.config) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(emailProviders.id, id))
      .returning();

    return row ? this.toEntity(row) : null;
  }
}
