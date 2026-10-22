import { and, eq, desc, isNull } from "drizzle-orm";
import { projects } from "../schema";
import { BaseRepositoryWithTimestamps } from "./baseRepository";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";

import type { IProjectRepository, Project } from "@senlo/core";

/**
 * Repository for managing projects in the database.
 * Extends BaseRepositoryWithTimestamps for common CRUD operations.
 */
export class ProjectRepository
  extends BaseRepositoryWithTimestamps<
    typeof projects,
    typeof projects.$inferSelect,
    Project
  >
  implements IProjectRepository
{
  protected table = projects;

  constructor(db: NodePgDatabase<typeof schema>) {
    super(db);
  }


  /**
   * Map a database row to a Project entity.
   * @param row - The raw database row
   * @returns The mapped Project
   */
  protected mapToEntity(row: typeof projects.$inferSelect): Project {
    return {
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description ?? undefined,
      providerId: row.providerId ?? undefined,
      aiProviderId: row.aiProviderId ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Create a new project.
   * @param data - Project data including name, optional description, userId and organizationId
   * @returns The created project
   */
  async create(data: {
    name: string;
    description?: string | null;
    userId?: string | null;
    organizationId?: string | null;
  }): Promise<Project> {
    const [row] = await this.db
      .insert(projects)
      .values({
        name: data.name,
        description: data.description ?? null,
        userId: data.userId ?? null,
        organizationId: data.organizationId ?? null,
      })
      .returning();

    return this.mapToEntity(row);
  }

  /** Projects the user owns personally, newest first. */
  async listForUser(userId: string): Promise<Project[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.organizationId)))
      .orderBy(desc(projects.createdAt));

    return rows.map((row) => this.mapToEntity(row));
  }

  /** Projects the organization owns, newest first. */
  async listForOrganization(organizationId: string): Promise<Project[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.createdAt));

    return rows.map((row) => this.mapToEntity(row));
  }

  /**
   * Update a project by ID.
   * @param id - The project ID
   * @param data - Fields to update (name, description, providerId)
   * @returns The updated project or null if not found
   */
  async update(
    id: number,
    data: {
      name?: string;
      description?: string | null;
      providerId?: number | null;
      aiProviderId?: number | null;
      organizationId?: string | null;
    },
  ): Promise<Project | null> {
    const [row] = await this.db
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    return row ? this.mapToEntity(row) : null;
  }
}
