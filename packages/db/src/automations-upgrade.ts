// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { WorkflowRepository } from "./repositories/workflowRepository";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

export interface AutomationsUpgradeResult {
  /** RUNNING runs without a version or a cursor, cancelled (`exit_reason = 'upgrade'`). */
  cancelledRuns: number;
  /** Steps rewritten to the current types and data keys. */
  nodesRewritten: number;
  /** ACTIVE workflows that got their first version. */
  versionsCreated: number;
}

type NodeRow = typeof schema.workflowNodes.$inferSelect;

/**
 * A step in the shape the engine reads, or null when it already is:
 * `condition_api` is `condition`, a condition has a `mode` (`"api"` for every
 * existing one), `action_email` is `action`, and an email step names its
 * trigger in `triggerId` (not `campaignId` / `templateId`).
 */
export function normalizeNode(node: Pick<NodeRow, "type" | "data">): { type: string; data: Record<string, unknown> } | null {
  let type = node.type;
  const data = { ...((node.data as Record<string, unknown> | null) ?? {}) };
  let changed = false;

  if (type === "condition_api") {
    type = "condition";
    changed = true;
  }
  if (type === "condition" && data.mode === undefined) {
    data.mode = "api";
    changed = true;
  }
  if (type === "action_email") {
    type = "action";
    changed = true;
  }
  if (type === "action") {
    const legacy = data.campaignId ?? data.templateId;
    if ((data.triggerId === undefined || data.triggerId === null || data.triggerId === "") && legacy !== undefined && legacy !== null && legacy !== "") {
      data.triggerId = legacy;
      changed = true;
    }
    if ("campaignId" in data || "templateId" in data) {
      delete data.campaignId;
      delete data.templateId;
      changed = true;
    }
  }

  return changed ? { type, data } : null;
}

/**
 * Brings automations from before versions to the current shape, once:
 * `pnpm db:upgrade-automations`, run by the start scripts after `db:push`.
 * Every step is idempotent, so running it again does nothing.
 *
 * 1. RUNNING runs without a version or a cursor are cancelled: they read the
 *    live graph or follow no cursor, which the engine no longer supports.
 *    Their contacts can enter again.
 * 2. Old step types and data keys are rewritten (`normalizeNode`).
 * 3. ACTIVE workflows without a version get version 1 from their graph, so
 *    new runs can start on them.
 */
export async function upgradeAutomations(
  db: Db,
  { log = () => {} }: { log?: (message: string) => void } = {},
): Promise<AutomationsUpgradeResult> {
  const cancelled = await db
    .update(schema.workflowExecutions)
    .set({ status: "CANCELLED", completedAt: new Date(), exitReason: "upgrade" })
    .where(
      and(
        eq(schema.workflowExecutions.status, "RUNNING"),
        or(isNull(schema.workflowExecutions.versionId), isNull(schema.workflowExecutions.currentNodeId)),
      ),
    )
    .returning({ id: schema.workflowExecutions.id });
  if (cancelled.length > 0) log(`automations: cancelled ${cancelled.length} run(s) from before versions and cursors`);

  const nodes = await db
    .select()
    .from(schema.workflowNodes)
    .where(inArray(schema.workflowNodes.type, ["condition", "condition_api", "action", "action_email"]));
  let nodesRewritten = 0;
  for (const node of nodes) {
    const next = normalizeNode(node);
    if (!next) continue;
    await db
      .update(schema.workflowNodes)
      .set({ type: next.type, data: next.data })
      .where(eq(schema.workflowNodes.id, node.id));
    nodesRewritten += 1;
  }
  if (nodesRewritten > 0) log(`automations: rewrote ${nodesRewritten} step(s) to the current types`);

  const workflows = new WorkflowRepository(db);
  const unpublished = await db
    .select({ id: schema.workflows.id })
    .from(schema.workflows)
    .where(and(eq(schema.workflows.status, "ACTIVE"), isNull(schema.workflows.activeVersionId)));
  for (const { id } of unpublished) {
    const [graphNodes, graphEdges] = await Promise.all([workflows.getNodes(id), workflows.getEdges(id)]);
    await workflows.publishVersion(id, {
      nodes: graphNodes.map(({ id: nodeId, type, data }) => ({ id: nodeId, type, data })),
      edges: graphEdges.map(({ id: edgeId, sourceNodeId, targetNodeId, sourceHandle }) => ({
        id: edgeId,
        sourceNodeId,
        targetNodeId,
        sourceHandle: sourceHandle ?? null,
      })),
    });
  }
  if (unpublished.length > 0) log(`automations: published version 1 of ${unpublished.length} active workflow(s)`);

  return { cancelledRuns: cancelled.length, nodesRewritten, versionsCreated: unpublished.length };
}

export interface AutomationsPrePushResult {
  /** Extra RUNNING runs of one contact in one workflow, cancelled (the newest stays). */
  duplicateRunsCancelled: number;
  /** Extra step rows of one step in one run, deleted (the newest stays). */
  duplicateStepsDeleted: number;
}

/**
 * Makes existing rows fit the unique indexes `db:push` is about to create,
 * so the push does not fail on old data: `pnpm db:upgrade-automations
 * --before-push`, run by the start scripts before `db:push`. Uses only
 * columns that existed before those indexes; does nothing on an empty
 * database or when there is nothing to fix.
 *
 * - One RUNNING run per contact and workflow (the entry race could make two).
 * - One step row per step and run (a redelivered job could add a second).
 */
export async function prepareAutomationsForPush(db: Db): Promise<AutomationsPrePushResult> {
  if (!(await tableExists(db, "workflow_executions"))) {
    return { duplicateRunsCancelled: 0, duplicateStepsDeleted: 0 };
  }
  const runs = await db.execute(sql`
    UPDATE workflow_executions
    SET status = 'CANCELLED', completed_at = now()
    WHERE status = 'RUNNING'
      AND id NOT IN (
        SELECT max(id) FROM workflow_executions WHERE status = 'RUNNING' GROUP BY workflow_id, contact_id
      )
  `);
  const steps = (await tableExists(db, "workflow_step_executions"))
    ? await db.execute(sql`
        DELETE FROM workflow_step_executions s
        USING workflow_step_executions newer
        WHERE s.execution_id = newer.execution_id
          AND s.node_id = newer.node_id
          AND s.id < newer.id
      `)
    : null;
  return { duplicateRunsCancelled: affected(runs), duplicateStepsDeleted: steps ? affected(steps) : 0 };
}

async function tableExists(db: Db, table: string): Promise<boolean> {
  const result = (await db.execute(sql`SELECT to_regclass(${table}) IS NOT NULL AS present`)) as unknown as {
    rows: Array<{ present: boolean }>;
  };
  return Boolean(result.rows[0]?.present);
}

/** Rows a statement changed: `rowCount` from node-postgres, `affectedRows` from PGlite. */
function affected(result: unknown): number {
  const r = result as { rowCount?: number | null; affectedRows?: number };
  return Number(r.rowCount ?? r.affectedRows ?? 0);
}
