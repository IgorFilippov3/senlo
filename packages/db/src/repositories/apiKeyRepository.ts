import { eq } from "drizzle-orm";
import { apiKeys } from "../schema";
import type { ApiKey } from "@senlo/core";
import { apiKeyPrefix } from "@senlo/core/server";
import { BaseRepository } from "./baseRepository";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

/**
 * API keys used for triggered email sends. The key itself is stored as a
 * SHA-256 hash plus a display prefix; rows from before hashing still carry
 * the plain `key` until `db:hash-api-keys` has run.
 */
export class ApiKeyRepository extends BaseRepository<
  typeof apiKeys,
  typeof apiKeys.$inferSelect,
  ApiKey
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db);
  }

  protected table = apiKeys;

  /** Never includes the key, hashed or plain. */
  protected mapToEntity(row: typeof apiKeys.$inferSelect): ApiKey {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      prefix: row.prefix ?? apiKeyPrefix(row.key ?? ""),
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    };
  }

  async findByHash(keyHash: string): Promise<ApiKey | null> {
    const [row] = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));
    return row ? this.mapToEntity(row) : null;
  }

  async findLegacyByKey(key: string): Promise<ApiKey | null> {
    const [row] = await this.db.select().from(apiKeys).where(eq(apiKeys.key, key));
    return row ? this.mapToEntity(row) : null;
  }

  async findByProject(projectId: number): Promise<ApiKey[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.projectId, projectId));

    return rows.map((r) => this.mapToEntity(r));
  }

  async create(data: {
    projectId: number;
    name: string;
    keyHash: string;
    prefix: string;
  }): Promise<ApiKey> {
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        projectId: data.projectId,
        name: data.name,
        keyHash: data.keyHash,
        prefix: data.prefix,
        createdAt: new Date(),
      })
      .returning();

    return this.mapToEntity(row);
  }

  async updateLastUsed(id: number): Promise<void> {
    await this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }
}
