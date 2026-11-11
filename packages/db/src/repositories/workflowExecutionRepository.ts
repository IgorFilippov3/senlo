import { eq, and, sql, lt, asc, desc, isNotNull, isNull, max } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";
import {
  CompleteStep,
  ExecutionContext,
  ExecutionExitReason,
  NewWorkflowExecution,
  IWorkflowExecutionRepository,
  WorkflowExecution,
  WorkflowStepExecution,
  WorkflowNodeStats,
  WorkflowRunFilter,
  WorkflowRunStats,
  WorkflowRunSummary,
} from "@senlo/core";

export class WorkflowExecutionRepository implements IWorkflowExecutionRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  private mapToExecution(
    row: typeof schema.workflowExecutions.$inferSelect,
  ): WorkflowExecution {
    const context = (row.context ?? {}) as Partial<ExecutionContext>;
    return {
      ...row,
      status: row.status as WorkflowExecution["status"],
      context: { ...context, steps: context.steps ?? {} },
    };
  }

  async create(data: NewWorkflowExecution): Promise<WorkflowExecution | null> {
    // The partial unique index on (workflow_id, contact_id) WHERE RUNNING
    // turns the second of two racing entries into no row.
    const [row] = await this.db
      .insert(schema.workflowExecutions)
      .values({
        workflowId: data.workflowId,
        contactId: data.contactId,
        status: "RUNNING",
        versionId: data.versionId,
        context: data.context,
        currentNodeId: data.currentNodeId,
        goalEvent: data.goalEvent ?? null,
        isTest: data.isTest ?? false,
        wakeAt: new Date(),
      })
      // A test run is outside the index's predicate, so it never conflicts.
      .onConflictDoNothing()
      .returning();
    return row ? this.mapToExecution(row) : null;
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
          eq(schema.workflowExecutions.isTest, false),
        ),
      );
    return row ? this.mapToExecution(row) : null;
  }

  async moveCursor(
    id: number,
    { from, to, wakeAt, completeStep }: { from: string; to: string; wakeAt: Date; completeStep?: CompleteStep },
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (completeStep) await completeStepRow(tx, completeStep);
      const moved = await tx
        .update(schema.workflowExecutions)
        .set({ currentNodeId: to, wakeAt, updatedAt: new Date() })
        .where(
          and(
            eq(schema.workflowExecutions.id, id),
            eq(schema.workflowExecutions.status, "RUNNING"),
            eq(schema.workflowExecutions.currentNodeId, from),
          ),
        )
        .returning({ id: schema.workflowExecutions.id });
      return moved.length > 0;
    });
  }

  async finish(
    id: number,
    end: {
      status: Exclude<WorkflowExecution["status"], "RUNNING">;
      exitReason: ExecutionExitReason;
      from?: string;
      completeStep?: CompleteStep;
    },
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (end.completeStep) await completeStepRow(tx, end.completeStep);
      const now = new Date();
      const ended = await tx
        .update(schema.workflowExecutions)
        .set({ status: end.status, exitReason: end.exitReason, completedAt: now, wakeAt: null, waitingEvent: null, updatedAt: now })
        .where(
          and(
            eq(schema.workflowExecutions.id, id),
            eq(schema.workflowExecutions.status, "RUNNING"),
            end.from !== undefined ? eq(schema.workflowExecutions.currentNodeId, end.from) : undefined,
          ),
        )
        .returning({ id: schema.workflowExecutions.id });
      return ended.length > 0;
    });
  }

  async findDue(before: Date, limit: number): Promise<Array<{ id: number; currentNodeId: string; generation: number }>> {
    // Picked through (status, wake_at).
    const rows = await this.db
      .select({
        id: schema.workflowExecutions.id,
        currentNodeId: schema.workflowExecutions.currentNodeId,
        generation: schema.workflowExecutions.generation,
      })
      .from(schema.workflowExecutions)
      .where(
        and(
          eq(schema.workflowExecutions.status, "RUNNING"),
          lt(schema.workflowExecutions.wakeAt, before),
          isNotNull(schema.workflowExecutions.currentNodeId),
        ),
      )
      .orderBy(asc(schema.workflowExecutions.wakeAt))
      .limit(limit);
    return rows.map((r) => ({ id: r.id, currentNodeId: r.currentNodeId!, generation: r.generation }));
  }

  async findWaiting(contactId: number, eventName: string): Promise<WorkflowExecution[]> {
    const rows = await this.db
      .select()
      .from(schema.workflowExecutions)
      .where(
        and(
          eq(schema.workflowExecutions.contactId, contactId),
          eq(schema.workflowExecutions.waitingEvent, eventName),
          eq(schema.workflowExecutions.status, "RUNNING"),
        ),
      );
    return rows.map((r) => this.mapToExecution(r));
  }

  async findByGoal(contactId: number, eventName: string): Promise<WorkflowExecution[]> {
    const rows = await this.db
      .select()
      .from(schema.workflowExecutions)
      .where(
        and(
          eq(schema.workflowExecutions.contactId, contactId),
          eq(schema.workflowExecutions.goalEvent, eventName),
          eq(schema.workflowExecutions.status, "RUNNING"),
        ),
      );
    return rows.map((r) => this.mapToExecution(r));
  }

  async startWait(id: number, { nodeId, event, wakeAt }: { nodeId: string; event: string; wakeAt: Date }): Promise<boolean> {
    const rows = await this.db
      .update(schema.workflowExecutions)
      .set({ waitingEvent: event, wakeAt, updatedAt: new Date() })
      .where(
        and(
          eq(schema.workflowExecutions.id, id),
          eq(schema.workflowExecutions.status, "RUNNING"),
          eq(schema.workflowExecutions.currentNodeId, nodeId),
          isNull(schema.workflowExecutions.waitingEvent),
        ),
      )
      .returning({ id: schema.workflowExecutions.id });
    return rows.length > 0;
  }

  async resolveWait(id: number, { nodeId, event }: { nodeId: string; event: string }): Promise<boolean> {
    const rows = await this.db
      .update(schema.workflowExecutions)
      .set({ waitingEvent: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.workflowExecutions.id, id),
          eq(schema.workflowExecutions.status, "RUNNING"),
          eq(schema.workflowExecutions.currentNodeId, nodeId),
          eq(schema.workflowExecutions.waitingEvent, event),
        ),
      )
      .returning({ id: schema.workflowExecutions.id });
    return rows.length > 0;
  }

  async restart(
    id: number,
    data: { versionId: number; context: ExecutionContext; currentNodeId: string; goalEvent: string | null },
  ): Promise<WorkflowExecution | null> {
    const now = new Date();
    const [row] = await this.db
      .update(schema.workflowExecutions)
      .set({
        versionId: data.versionId,
        context: data.context,
        currentNodeId: data.currentNodeId,
        goalEvent: data.goalEvent,
        generation: sql`${schema.workflowExecutions.generation} + 1`,
        waitingEvent: null,
        wakeAt: now,
        startedAt: now,
        updatedAt: now,
      })
      .where(and(eq(schema.workflowExecutions.id, id), eq(schema.workflowExecutions.status, "RUNNING")))
      .returning();
    return row ? this.mapToExecution(row) : null;
  }

  async cancel(id: number, exitReason: ExecutionExitReason): Promise<boolean> {
    const now = new Date();
    const rows = await this.db
      .update(schema.workflowExecutions)
      .set({ status: "CANCELLED", exitReason, completedAt: now, wakeAt: null, waitingEvent: null, updatedAt: now })
      .where(and(eq(schema.workflowExecutions.id, id), eq(schema.workflowExecutions.status, "RUNNING")))
      .returning({ id: schema.workflowExecutions.id });
    return rows.length > 0;
  }

  async listRuns(workflowId: number, filter: WorkflowRunFilter): Promise<WorkflowRunSummary[]> {
    const w = schema.workflowExecutions;
    const rows = await this.db
      .select({ run: w, contactEmail: schema.contacts.email })
      .from(w)
      .leftJoin(schema.contacts, eq(schema.contacts.id, w.contactId))
      .where(
        and(
          eq(w.workflowId, workflowId),
          filter.includeTests ? undefined : eq(w.isTest, false),
          filter.status ? eq(w.status, filter.status) : undefined,
          filter.contactId !== undefined ? eq(w.contactId, filter.contactId) : undefined,
          filter.beforeId !== undefined ? lt(w.id, filter.beforeId) : undefined,
        ),
      )
      .orderBy(desc(w.id))
      .limit(filter.limit);
    return rows.map((r) => mapSummary(r.run, { contactEmail: r.contactEmail }));
  }

  async listContactRuns(contactId: number, limit: number): Promise<WorkflowRunSummary[]> {
    const w = schema.workflowExecutions;
    const rows = await this.db
      .select({ run: w, workflowName: schema.workflows.name, contactEmail: schema.contacts.email })
      .from(w)
      .innerJoin(schema.workflows, eq(schema.workflows.id, w.workflowId))
      .leftJoin(schema.contacts, eq(schema.contacts.id, w.contactId))
      .where(eq(w.contactId, contactId))
      .orderBy(desc(w.id))
      .limit(limit);
    return rows.map((r) => mapSummary(r.run, { contactEmail: r.contactEmail, workflowName: r.workflowName }));
  }

  async setStepOutput(id: number, nodeId: string, output: unknown): Promise<void> {
    await this.db
      .update(schema.workflowExecutions)
      .set({
        context: sql`jsonb_set(
          jsonb_set(${schema.workflowExecutions.context}, '{steps}', coalesce(${schema.workflowExecutions.context} -> 'steps', '{}'::jsonb)),
          array['steps', ${nodeId}::text],
          ${JSON.stringify(output ?? null)}::jsonb
        )`,
        updatedAt: new Date(),
      })
      .where(eq(schema.workflowExecutions.id, id));
  }

  async cancelRunning(
    contactId: number,
    { workflowId, exitReason, lifecycleOnly }: { workflowId?: number; exitReason: ExecutionExitReason; lifecycleOnly?: boolean },
  ): Promise<number[]> {
    const now = new Date();
    const lifecycleVersions = sql`${schema.workflowExecutions.versionId} IN (
      SELECT ${schema.workflowVersions.id} FROM ${schema.workflowVersions}
      WHERE ${schema.workflowVersions.settings} ->> 'kind' = 'lifecycle'
    )`;
    const rows = await this.db
      .update(schema.workflowExecutions)
      .set({ status: "CANCELLED", exitReason, completedAt: now, wakeAt: null, waitingEvent: null, updatedAt: now })
      .where(
        and(
          eq(schema.workflowExecutions.contactId, contactId),
          eq(schema.workflowExecutions.status, "RUNNING"),
          workflowId !== undefined ? eq(schema.workflowExecutions.workflowId, workflowId) : undefined,
          lifecycleOnly ? lifecycleVersions : undefined,
        ),
      )
      .returning({ id: schema.workflowExecutions.id });
    return rows.map((r) => r.id);
  }

  async lastStartedAt(workflowId: number, contactId: number): Promise<Date | null> {
    const [row] = await this.db
      .select({ at: max(schema.workflowExecutions.startedAt) })
      .from(schema.workflowExecutions)
      .where(
        and(
          eq(schema.workflowExecutions.workflowId, workflowId),
          eq(schema.workflowExecutions.contactId, contactId),
          eq(schema.workflowExecutions.isTest, false),
        ),
      );
    return row?.at ?? null;
  }

  async getRunStats(workflowId: number): Promise<WorkflowRunStats> {
    const rows = await this.db
      .select({
        status: schema.workflowExecutions.status,
        exitReason: schema.workflowExecutions.exitReason,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.workflowExecutions)
      .where(and(eq(schema.workflowExecutions.workflowId, workflowId), eq(schema.workflowExecutions.isTest, false)))
      .groupBy(schema.workflowExecutions.status, schema.workflowExecutions.exitReason);
    const stats: WorkflowRunStats = { started: 0, running: 0, completed: 0, goal: 0, failed: 0, cancelled: 0 };
    for (const row of rows) {
      const n = Number(row.count);
      stats.started += n;
      if (row.status === "RUNNING") stats.running += n;
      else if (row.status === "FAILED") stats.failed += n;
      else if (row.status === "CANCELLED") stats.cancelled += n;
      else if (row.exitReason === "goal") stats.goal += n;
      else stats.completed += n;
    }
    return stats;
  }

  async claimStep(executionId: number, nodeId: string, generation = 0): Promise<WorkflowStepExecution> {
    const [created] = await this.db
      .insert(schema.workflowStepExecutions)
      .values({ executionId, nodeId, generation, status: "PENDING" })
      .onConflictDoNothing({
        target: [
          schema.workflowStepExecutions.executionId,
          schema.workflowStepExecutions.nodeId,
          schema.workflowStepExecutions.generation,
        ],
      })
      .returning();
    if (created) return mapStep(created);
    const [existing] = await this.db
      .select()
      .from(schema.workflowStepExecutions)
      .where(
        and(
          eq(schema.workflowStepExecutions.executionId, executionId),
          eq(schema.workflowStepExecutions.nodeId, nodeId),
          eq(schema.workflowStepExecutions.generation, generation),
        ),
      );
    return mapStep(existing);
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

  async getStepExecutions(executionId: number, generation?: number): Promise<WorkflowStepExecution[]> {
    const rows = await this.db
      .select()
      .from(schema.workflowStepExecutions)
      .where(
        and(
          eq(schema.workflowStepExecutions.executionId, executionId),
          generation !== undefined ? eq(schema.workflowStepExecutions.generation, generation) : undefined,
        ),
      )
      .orderBy(asc(schema.workflowStepExecutions.startedAt), asc(schema.workflowStepExecutions.id));

    return rows.map(mapStep);
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
      .where(and(eq(schema.workflowExecutions.workflowId, workflowId), eq(schema.workflowExecutions.isTest, false)))
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
          skipped: 0,
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
      } else if (row.status === "SKIPPED") {
        stats.skipped += row.count;
      }
    }

    return Array.from(statsMap.values());
  }
}

function mapSummary(
  row: typeof schema.workflowExecutions.$inferSelect,
  extra: { contactEmail: string | null; workflowName?: string },
): WorkflowRunSummary {
  return {
    id: row.id,
    workflowId: row.workflowId,
    ...(extra.workflowName !== undefined ? { workflowName: extra.workflowName } : {}),
    contactId: row.contactId,
    contactEmail: extra.contactEmail,
    status: row.status as WorkflowRunSummary["status"],
    exitReason: row.exitReason,
    currentNodeId: row.currentNodeId,
    isTest: row.isTest,
    versionId: row.versionId,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function mapStep(row: typeof schema.workflowStepExecutions.$inferSelect): WorkflowStepExecution {
  return {
    ...row,
    status: row.status as WorkflowStepExecution["status"],
    result: row.result as Record<string, any> | null,
  };
}

type Tx = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];

async function completeStepRow(tx: Tx, step: CompleteStep): Promise<void> {
  await tx
    .update(schema.workflowStepExecutions)
    .set({
      status: step.status ?? "COMPLETED",
      completedAt: new Date(),
      ...(step.result !== undefined ? { result: step.result } : {}),
    })
    .where(eq(schema.workflowStepExecutions.id, step.id));
}
