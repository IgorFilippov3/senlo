// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Edge, Node } from "@xyflow/react";
import { layoutWorkflow } from "./layoutWorkflow";

/** A step as an export, a template or a stored graph has it. */
export interface PreviewNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/** An edge in either shape: an export's (`source`) or a stored one's (`sourceNodeId`). */
export type PreviewEdge =
  | { id?: string; source: string; target: string; sourceHandle?: string | null }
  | { id?: string; sourceNodeId: string; targetNodeId: string; sourceHandle?: string | null };

/**
 * The graph laid out as the editor lays it out, without `+` placeholders:
 * what a preview draws. Pure; exported for tests.
 */
export function previewGraph(
  nodes: PreviewNode[],
  edges: PreviewEdge[],
  withStats: Set<string> = new Set(),
): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = nodes.map((n) => ({ id: n.id, type: n.type, data: n.data, position: { x: 0, y: 0 } }));
  const flowEdges: Edge[] = edges.map((e, i) => {
    const source = "source" in e ? e.source : e.sourceNodeId;
    const target = "target" in e ? e.target : e.targetNodeId;
    return { id: e.id ?? `${source}-${target}-${i}`, source, target, sourceHandle: e.sourceHandle ?? null };
  });
  const layout = layoutWorkflow(flowNodes, flowEdges, { placeholders: false, withStats });
  return {
    nodes: layout.nodes.map((n) => ({ ...n, selectable: false, focusable: false, draggable: false })),
    edges: layout.edges,
  };
}

