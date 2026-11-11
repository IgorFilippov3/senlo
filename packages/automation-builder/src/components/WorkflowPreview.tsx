// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useMemo } from "react";
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles.css";
import type { WorkflowNodeStats } from "@senlo/core";
import { cn } from "@senlo/ui";
import { EDGE_TYPE } from "../layout/layoutWorkflow";
import { previewGraph, type PreviewEdge, type PreviewNode } from "../layout/previewGraph";
import { BuilderProvider, type BuilderTrigger } from "./BuilderContext";
import { WorkflowEdge } from "./edges/WorkflowEdge";
import { STEP_NODE_TYPES, defaultEdgeOptions } from "./nodes/nodeTypes";

export interface WorkflowPreviewProps {
  nodes: PreviewNode[];
  edges: PreviewEdge[];
  /** Names email steps by trigger id (an export names them by `label` already). */
  triggers?: BuilderTrigger[];
  /** Counts on step cards, by node id. */
  nodeStats?: Record<string, WorkflowNodeStats>;
  className?: string;
}

const edgeTypes = { [EDGE_TYPE]: WorkflowEdge };

/**
 * A read-only canvas of a workflow: the editor's cards, branches and lines,
 * fitted to its box. It can be panned (a tall flow), not zoomed, edited or
 * selected, and it does not touch the editor's store, so it is safe next to
 * an open editor. Used for template and import previews.
 */
export function WorkflowPreview({ nodes, edges, triggers = [], nodeStats, className }: WorkflowPreviewProps) {
  const graph = useMemo(
    () => previewGraph(nodes, edges, new Set(Object.keys(nodeStats ?? {}))),
    [nodes, edges, nodeStats],
  );
  // A new graph is a new canvas, fitted again.
  const key = nodes.map((n) => n.id).join("|");

  return (
    <BuilderProvider
      value={{ triggers, eventNames: [], fieldSuggestions: { contact: [], event: [] }, readOnly: true, nodeStats }}
    >
      <div className={cn("relative h-[420px] w-full overflow-hidden rounded-lg bg-[#fafafa]", className)}>
        <ReactFlowProvider key={key}>
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={STEP_NODE_TYPES}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            fitViewOptions={{ padding: 0.12, maxZoom: 1, minZoom: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            nodesFocusable={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            panOnScroll={false}
            panOnDrag
            preventScrolling={false}
            minZoom={0.2}
            maxZoom={1}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={2} color="#b4b4bc" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </BuilderProvider>
  );
}
