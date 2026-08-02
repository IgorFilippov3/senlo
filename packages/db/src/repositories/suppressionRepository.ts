import { eq, and } from "drizzle-orm";
import { suppressions } from "../schema";
import { BaseRepository } from "./baseRepository";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";
import type { ISuppressionRepository, Suppression } from "@senlo/core";

export class SuppressionRepository
  extends BaseRepository<
    typeof suppressions,
    typeof suppressions.$inferSelect,
    Suppression
  >
  implements ISuppressionRepository
{
  protected table = suppressions;

  constructor(db: NodePgDatabase<typeof schema>) {
    super(db);
  }


  protected mapToEntity(row: typeof suppressions.$inferSelect): Suppression {
    return {
      id: row.id,
      projectId: row.projectId,
      email: row.email,
      reason: row.reason as "SPAM" | "BOUNCE",
      createdAt: row.createdAt,
    };
  }

  async create(
    data: Omit<Suppression, "id" | "createdAt">,
  ): Promise<Suppression> {
    const [row] = await this.db
      .insert(suppressions)
      .values({
        projectId: data.projectId,
        email: data.email,
        reason: data.reason,
      })
      .onConflictDoUpdate({
        target: [suppressions.projectId, suppressions.email],
        set: { reason: data.reason },
      })
      .returning();

    return this.mapToEntity(row);
  }

  async findByProjectAndEmail(
    projectId: number,
    email: string,
  ): Promise<Suppression | null> {
    const [row] = await this.db
      .select()
      .from(suppressions)
      .where(
        and(
          eq(suppressions.projectId, projectId),
          eq(suppressions.email, email),
        ),
      );

    return row ? this.mapToEntity(row) : null;
  }

  async findByProject(projectId: number): Promise<Suppression[]> {
    const { desc } = await import("drizzle-orm");
    const rows = await this.db
      .select()
      .from(suppressions)
      .where(eq(suppressions.projectId, projectId))
      .orderBy(desc(suppressions.createdAt));

    return rows.map((r) => this.mapToEntity(r));
  }

  async findAllByUser(userId: string): Promise<(Suppression & { projectName: string })[]> {
    const { projects } = await import("../schema");
    const { eq, desc } = await import("drizzle-orm");
    
    const rows = await this.db
      .select({
        suppression: suppressions,
        projectName: projects.name
      })
      .from(suppressions)
      .innerJoin(projects, eq(suppressions.projectId, projects.id))
      .where(eq(projects.userId, userId))
      .orderBy(desc(suppressions.createdAt));

    return rows.map((row) => ({
      ...this.mapToEntity(row.suppression),
      projectName: row.projectName
    }));
  }
}
