// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A workflow as data: the JSON an export writes and an import (or a gallery
 * template) reads. Isomorphic: the import dialog parses a file with the same
 * code the server checks it with.
 *
 * What does not travel between workspaces is left out or replaced:
 * - an email step's trigger id becomes the trigger's name (`emailRef`); the
 *   import maps names back to triggers of the target workspace (D7);
 * - HTTP request headers keep their names only: values are sealed with the
 *   instance's key and are entered again after an import (D8);
 * - node and edge ids are new on import (they are unique per instance), and
 *   references to them inside the graph (email and step rules,
 *   `{{steps.<id>…}}` in step data) follow.
 */

import { z } from "zod";
import type { WorkflowGraphSnapshot, WorkflowSettings } from "./domain";

export const WORKFLOW_EXPORT_FORMAT = "senlo.workflow";
export const WORKFLOW_EXPORT_VERSION = 1;

export interface WorkflowExportNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface WorkflowExportEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
}

export interface WorkflowExport {
  format: typeof WORKFLOW_EXPORT_FORMAT;
  version: typeof WORKFLOW_EXPORT_VERSION;
  name: string;
  description?: string | null;
  settings: WorkflowSettings;
  nodes: WorkflowExportNode[];
  edges: WorkflowExportEdge[];
}

export const WorkflowExportSchema = z.object({
  format: z.literal(WORKFLOW_EXPORT_FORMAT, {
    errorMap: () => ({ message: "Not a Senlo automation export" }),
  }),
  version: z.literal(WORKFLOW_EXPORT_VERSION, {
    errorMap: () => ({ message: `Unsupported export version (this Senlo reads version ${WORKFLOW_EXPORT_VERSION})` }),
  }),
  name: z.string().trim().min(1).max(255),
  description: z.string().max(1000).nullish(),
  settings: z.record(z.unknown()).default({}),
  nodes: z
    .array(z.object({ id: z.string().min(1), type: z.string().min(1), data: z.record(z.unknown()).default({}) }))
    .max(500),
  edges: z
    .array(
      z.object({
        id: z.string().min(1),
        source: z.string().min(1),
        target: z.string().min(1),
        sourceHandle: z.string().nullish().transform((v) => v ?? null),
      }),
    )
    .max(1000),
});

/** The export, or the first reason it cannot be read. */
export function parseWorkflowExport(
  raw: unknown,
): { success: true; data: WorkflowExport } | { success: false; error: string } {
  const parsed = WorkflowExportSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? ` (${issue.path.join(".")})` : "";
    return { success: false, error: `${issue.message}${where}` };
  }
  return { success: true, data: parsed.data as WorkflowExport };
}

/**
 * The export of a workflow's graph and settings. `triggerName` names the
 * trigger an email step sends; a step whose trigger is gone exports empty.
 */
export function buildWorkflowExport(
  workflow: { name: string; description?: string | null; settings?: WorkflowSettings },
  graph: WorkflowGraphSnapshot,
  triggerName: (triggerId: number) => string | null,
): WorkflowExport {
  return {
    format: WORKFLOW_EXPORT_FORMAT,
    version: WORKFLOW_EXPORT_VERSION,
    name: workflow.name,
    ...(workflow.description ? { description: workflow.description } : {}),
    settings: workflow.settings ?? {},
    nodes: graph.nodes.map((node) => ({ id: node.id, type: node.type, data: exportData(node.type, node.data, triggerName) })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      sourceHandle: edge.sourceHandle ?? null,
    })),
  };
}

function exportData(
  type: string,
  data: Record<string, unknown>,
  triggerName: (triggerId: number) => string | null,
): Record<string, unknown> {
  if (type === "action") {
    const { triggerId, ...rest } = data;
    const id = Number(triggerId);
    const name = Number.isInteger(id) && id > 0 ? triggerName(id) : null;
    return name ? { ...rest, emailRef: name } : rest;
  }
  if (type === "http_request" && Array.isArray(data.headers)) {
    return {
      ...data,
      headers: (data.headers as Array<{ name?: unknown }>)
        .filter((h) => h && typeof h.name === "string")
        .map((h) => ({ name: h.name as string })),
    };
  }
  return data;
}

/** The trigger names the export's email steps send, in order of first use. */
export function exportEmailRefs(exp: Pick<WorkflowExport, "nodes">): string[] {
  const refs: string[] = [];
  for (const node of exp.nodes) {
    const ref = node.type === "action" ? node.data.emailRef : undefined;
    if (typeof ref === "string" && ref !== "" && !refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

/** HTTP request headers whose values must be entered again after an import. */
export function exportSecretHeaders(exp: Pick<WorkflowExport, "nodes">): Array<{ nodeId: string; name: string }> {
  const headers: Array<{ nodeId: string; name: string }> = [];
  for (const node of exp.nodes) {
    if (node.type !== "http_request" || !Array.isArray(node.data.headers)) continue;
    for (const header of node.data.headers as Array<{ name?: unknown }>) {
      if (header && typeof header.name === "string") headers.push({ nodeId: node.id, name: header.name });
    }
  }
  return headers;
}

/**
 * The export as a builder graph for a new workflow: fresh node and edge ids
 * (from `newId`), references to them rewritten, each email step's
 * `emailRef` replaced by the trigger `emails` maps it to (none leaves the
 * step to choose an email), and header values dropped.
 */
export function instantiateWorkflowExport(
  exp: Pick<WorkflowExport, "nodes" | "edges">,
  emails: ReadonlyMap<string, number | null>,
  newId: () => string,
): {
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle: string | null }>;
} {
  const ids = new Map(exp.nodes.map((n) => [n.id, newId()]));
  const nodes = exp.nodes.map((node) => {
    let data = remapIds(node.data, ids) as Record<string, unknown>;
    if (node.type === "action") {
      const { emailRef, triggerId: _ignored, ...rest } = data;
      const triggerId = typeof emailRef === "string" ? emails.get(emailRef) ?? null : null;
      data = triggerId !== null ? { ...rest, triggerId: String(triggerId) } : rest;
    }
    if (node.type === "http_request" && Array.isArray(data.headers)) {
      data = {
        ...data,
        headers: (data.headers as Array<{ name?: unknown }>)
          .filter((h) => h && typeof h.name === "string")
          .map((h) => ({ name: h.name as string })),
      };
    }
    return { id: ids.get(node.id)!, type: node.type, data };
  });
  const edges = exp.edges.map((edge) => ({
    id: newId(),
    source: ids.get(edge.source) ?? edge.source,
    target: ids.get(edge.target) ?? edge.target,
    sourceHandle: edge.sourceHandle,
  }));
  return { nodes, edges };
}

/** Rewrites node ids inside step data: `nodeId` fields of rules, and `steps.<id>` in text. */
function remapIds(value: unknown, ids: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") {
    return value.replace(/steps\.([A-Za-z0-9_-]+)/g, (match, id: string) => (ids.has(id) ? `steps.${ids.get(id)}` : match));
  }
  if (Array.isArray(value)) return value.map((item) => remapIds(item, ids));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        key === "nodeId" && typeof item === "string" && ids.has(item) ? ids.get(item) : remapIds(item, ids),
      ]),
    );
  }
  return value;
}
