import { eq, desc } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

/**
 * Abstract base repository providing common CRUD operations.
 *
 * @typeParam TTable - The Drizzle table type
 * @typeParam TSelect - The type returned by select queries (inferred from table)
 * @typeParam TEntity - The domain entity type returned by repository methods
 */
export abstract class BaseRepository<
  TTable extends PgTable & { id: any },
  TSelect,
  TEntity
> {
  constructor(protected readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * The Drizzle table this repository operates on.
   */
  protected abstract table: TTable;

  /**
   * Map a database row to a domain entity.
   * @param row - The raw database row
   * @returns The mapped domain entity
   */
  protected abstract mapToEntity(row: TSelect): TEntity;

  /**
   * Find an entity by its ID.
   * @param id - The entity ID
   * @returns The entity or null if not found
   */
  async findById(id: number): Promise<TEntity | null> {
    const [row] = await this.db
      .select()
      .from(this.table as any)
      .where(eq((this.table as any).id, id));

    return row ? this.mapToEntity(row as TSelect) : null;
  }

  /**
   * Delete an entity by its ID.
   * @param id - The entity ID
   */
  async delete(id: number): Promise<void> {
    await this.db.delete(this.table as any).where(eq((this.table as any).id, id));
  }
}

/**
 * Base repository with additional support for ordered queries.
 * Extends BaseRepository with findAll method that orders by createdAt.
 */
export abstract class BaseRepositoryWithTimestamps<
  TTable extends PgTable & { id: any; createdAt: any },
  TSelect,
  TEntity
> extends BaseRepository<TTable, TSelect, TEntity> {
  /**
   * Get all entities, ordered by creation date (newest first).
   * @returns Array of all entities
   */
  async findAll(): Promise<TEntity[]> {
    const rows = await this.db
      .select()
      .from(this.table as any)
      .orderBy(desc((this.table as any).createdAt));

    return rows.map((row) => this.mapToEntity(row as TSelect));
  }
}
