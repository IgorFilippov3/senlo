import { eq, desc } from "drizzle-orm";
import { db } from "../client";
import { projects } from "../schema";
import { BaseRepositoryWithTimestamps } from "./baseRepository";

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

  /**
   * Map a database row to a Project entity.
   * @param row - The raw database row
   * @returns The mapped Project
   */
  protected mapToEntity(row: typeof projects.$inferSelect): Project {
    return {
      id: row.id,
      userId: row.userId,
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
   * @param data - Project data including name, optional description and userId
   * @returns The created project
   */
  async create(data: {
    name: string;
    description?: string | null;
    userId?: string | null;
  }): Promise<Project> {
    const [row] = await db
      .insert(projects)
      .values({
        name: data.name,
        description: data.description ?? null,
        userId: data.userId ?? null,
      })
      .returning();

    return this.mapToEntity(row);
  }

  /**
   * Find projects by user ID.
   * @param userId - The user ID
   * @returns Array of projects belonging to the user
   */
  async findByUser(userId: string): Promise<Project[]> {
    const rows = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
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
    },
  ): Promise<Project | null> {
    const [row] = await db
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
