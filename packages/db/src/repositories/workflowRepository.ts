import { eq, desc, and } from "drizzle-orm";
import { BaseRepositoryWithTimestamps } from "./baseRepository";
import * as schema from "../schema";
import {
  IWorkflowRepository,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
} from "@senlo/core";

export class WorkflowRepository
  extends BaseRepositoryWithTimestamps<
    typeof schema.workflows,
    typeof schema.workflows.$inferSelect,
    Workflow
  >
  implements IWorkflowRepository
{
  protected table = schema.workflows;

  protected mapToEntity(row: typeof schema.workflows.$inferSelect): Workflow {
    return {
      ...row,
      status: row.status as Workflow["status"],
    };
  }

  async create(
    data: Omit<Workflow, "id" | "createdAt" | "updatedAt">,
  ): Promise<Workflow> {
    const [row] = await this.db.insert(this.table).values(data).returning();
    return this.mapToEntity(row);
  }

  async findByProject(projectId: number): Promise<Workflow[]> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(eq(this.table.projectId, projectId))
      .orderBy(desc(this.table.createdAt));

    return rows.map((row) => this.mapToEntity(row));
  }

  async update(
    id: number,
    data: Partial<
      Omit<Workflow, "id" | "projectId" | "createdAt" | "updatedAt">
    >,
  ): Promise<Workflow | null> {
    const [row] = await this.db
      .update(this.table)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(this.table.id, id))
      .returning();

    return row ? this.mapToEntity(row) : null;
  }

  async getNodes(workflowId: number): Promise<WorkflowNode[]> {
    const rows = await this.db
      .select()
      .from(schema.workflowNodes)
      .where(eq(schema.workflowNodes.workflowId, workflowId));

    return rows.map((row) => ({
      ...row,
      data: row.data as Record<string, any>,
    }));
  }

  async getEdges(workflowId: number): Promise<WorkflowEdge[]> {
    const rows = await this.db
      .select()
      .from(schema.workflowEdges)
      .where(eq(schema.workflowEdges.workflowId, workflowId));

    return rows.map((row) => ({
      ...row,
      sourceHandle: row.sourceHandle || null,
    }));
  }

  async saveGraph(
    workflowId: number,
    nodes: Omit<WorkflowNode, "workflowId">[],
    edges: Omit<WorkflowEdge, "workflowId">[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 1. Delete existing nodes and edges
      await tx
        .delete(schema.workflowEdges)
        .where(eq(schema.workflowEdges.workflowId, workflowId));
      await tx
        .delete(schema.workflowNodes)
        .where(eq(schema.workflowNodes.workflowId, workflowId));

      // 2. Insert new nodes
      if (nodes.length > 0) {
        await tx.insert(schema.workflowNodes).values(
          nodes.map((n) => ({
            ...n,
            workflowId,
          })),
        );
      }

      // 3. Insert new edges
      if (edges.length > 0) {
        await tx.insert(schema.workflowEdges).values(
          edges.map((e) => ({
            ...e,
            workflowId,
          })),
        );
      }

      // 4. Update workflow updatedAt
      await tx
        .update(schema.workflows)
        .set({ updatedAt: new Date() })
        .where(eq(schema.workflows.id, workflowId));
    });
  }
}
