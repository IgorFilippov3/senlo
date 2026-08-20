import { eq, and, sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";
import {
  IWorkflowExecutionRepository,
  WorkflowExecution,
  WorkflowStepExecution,
  WorkflowNodeStats,
} from "@senlo/core";

export class WorkflowExecutionRepository implements IWorkflowExecutionRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  private mapToExecution(
    row: typeof schema.workflowExecutions.$inferSelect,
  ): WorkflowExecution {
    return {
      ...row,
      status: row.status as WorkflowExecution["status"],
    };
  }

  async create(
    data: Omit<WorkflowExecution, "id" | "startedAt">,
  ): Promise<WorkflowExecution> {
    const [row] = await this.db
      .insert(schema.workflowExecutions)
      .values(data)
      .returning();
    return this.mapToExecution(row);
  }

  async findById(id: number): Promise<WorkflowExecution | null> {
    const [row] = await this.db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.id, id));
    return row ? this.mapToExecution(row) : null;
  }

  async findRunningByContact(
    workflowId: number,
    contactId: number,
  ): Promise<WorkflowExecution | null> {
    const [row] = await this.db
      .select()
      .from(schema.workflowExecutions)
      .where(
        and(
          eq(schema.workflowExecutions.workflowId, workflowId),
          eq(schema.workflowExecutions.contactId, contactId),
          eq(schema.workflowExecutions.status, "RUNNING"),
        ),
      );
    return row ? this.mapToExecution(row) : null;
  }

  async updateStatus(
    id: number,
    status: WorkflowExecution["status"],
    completedAt?: Date,
  ): Promise<void> {
    await this.db
      .update(schema.workflowExecutions)
      .set({ status, completedAt })
      .where(eq(schema.workflowExecutions.id, id));
  }

  async createStepExecution(
    data: Omit<WorkflowStepExecution, "id" | "startedAt">,
  ): Promise<WorkflowStepExecution> {
    const [row] = await this.db
      .insert(schema.workflowStepExecutions)
      .values(data)
      .returning();
    return {
      ...row,
      status: row.status as WorkflowStepExecution["status"],
      result: row.result as Record<string, any> | null,
    };
  }

  async updateStepExecution(
    id: number,
    data: Partial<Omit<WorkflowStepExecution, "id" | "startedAt">>,
  ): Promise<void> {
    await this.db
      .update(schema.workflowStepExecutions)
      .set(data)
      .where(eq(schema.workflowStepExecutions.id, id));
  }

  async getStepExecutions(
    executionId: number,
  ): Promise<WorkflowStepExecution[]> {
    const rows = await this.db
      .select()
      .from(schema.workflowStepExecutions)
      .where(eq(schema.workflowStepExecutions.executionId, executionId));

    return rows.map((row) => ({
      ...row,
      status: row.status as WorkflowStepExecution["status"],
      result: row.result as Record<string, any> | null,
    }));
  }

  async getNodeStats(workflowId: number): Promise<WorkflowNodeStats[]> {
    const rows = await this.db
      .select({
        nodeId: schema.workflowStepExecutions.nodeId,
        status: schema.workflowStepExecutions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.workflowStepExecutions)
      .innerJoin(
        schema.workflowExecutions,
        eq(
          schema.workflowStepExecutions.executionId,
          schema.workflowExecutions.id,
        ),
      )
      .where(eq(schema.workflowExecutions.workflowId, workflowId))
      .groupBy(
        schema.workflowStepExecutions.nodeId,
        schema.workflowStepExecutions.status,
      );

    const statsMap = new Map<string, WorkflowNodeStats>();

    for (const row of rows) {
      if (!statsMap.has(row.nodeId)) {
        statsMap.set(row.nodeId, {
          nodeId: row.nodeId,
          total: 0,
          active: 0,
          completed: 0,
          failed: 0,
        });
      }

      const stats = statsMap.get(row.nodeId)!;
      stats.total += row.count;

      if (row.status === "PENDING") {
        stats.active += row.count;
      } else if (row.status === "COMPLETED") {
        stats.completed += row.count;
      } else if (row.status === "FAILED") {
        stats.failed += row.count;
      }
    }

    return Array.from(statsMap.values());
  }
}
