// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { WorkflowRepository } from "./repositories/workflowRepository";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

export interface AutomationsUpgradeResult {
  /** RUNNING runs without a version, cancelled (`exit_reason = 'upgrade'`). */
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
 * 1. RUNNING runs without a version are cancelled: they read the live graph,
 *    which the engine no longer does. Their contacts can enter again.
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
    .where(and(eq(schema.workflowExecutions.status, "RUNNING"), isNull(schema.workflowExecutions.versionId)))
    .returning({ id: schema.workflowExecutions.id });
  if (cancelled.length > 0) log(`automations: cancelled ${cancelled.length} run(s) started before versions`);

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
