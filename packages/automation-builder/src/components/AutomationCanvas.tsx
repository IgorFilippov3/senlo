import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useNodesInitialized,
  useReactFlow,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles.css";
import type { WorkflowNodeStats } from "@senlo/core";
import { Button, Dialog } from "@senlo/ui";
import { useAutomationStore } from "../store/automationStore";
import { EDGE_TYPE, PLACEHOLDER_TYPE, layoutWorkflow } from "../layout/layoutWorkflow";
import { BuilderProvider, type BuilderFieldSuggestions, type BuilderTrigger } from "./BuilderContext";
import { DeleteStepDialog } from "./DeleteStepDialog";
import { SidePanel } from "./SidePanel";
import { WorkflowEdge } from "./edges/WorkflowEdge";
import { ExitNode } from "./nodes/ExitNode";
import { PlaceholderNode } from "./nodes/PlaceholderNode";
import { StepNode } from "./nodes/StepNode";

const nodeTypes = {
  trigger: StepNode,
  action: StepNode,
  delay: StepNode,
  condition: StepNode,
  wait_event: StepNode,
  update_contact: StepNode,
  exit: ExitNode,
  [PLACEHOLDER_TYPE]: PlaceholderNode,
};

const edgeTypes = { [EDGE_TYPE]: WorkflowEdge };

const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#d4d4d8" },
};

interface Props {
  triggers?: BuilderTrigger[];
  stats?: WorkflowNodeStats[];
  /** Event names the project has sent, suggested for a custom event trigger. */
  eventNames?: string[];
  /** Field names for the rule builder. */
  fieldSuggestions?: BuilderFieldSuggestions;
  /** Days the workspace keeps its event history; shown next to history rules. */
  historyRetentionDays?: number | null;
}

const NO_FIELDS: BuilderFieldSuggestions = { contact: [], event: [] };

/**
 * The automation canvas. Steps are laid out from the graph's structure and
 * cannot be dragged; the canvas itself pans and zooms. A step is added from
 * a `+` (at an open end, or on an edge to insert it) and set up in the side
 * panel.
 */
export const AutomationCanvas = ({
  triggers = [],
  stats = [],
  eventNames = [],
  fieldSuggestions = NO_FIELDS,
  historyRetentionDays,
}: Props) => {
  const { nodes, edges, nodeStats, selectedNodeId, setSelectedNodeId, setNodeStats, validationError, setValidationError } =
    useAutomationStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const statsString = JSON.stringify(stats);
  useEffect(() => {
    setNodeStats(stats);
  }, [statsString, setNodeStats]);

  const layout = useMemo(
    () => layoutWorkflow(nodes, edges, { selectedId: selectedNodeId, withStats: new Set(Object.keys(nodeStats)) }),
    [nodes, edges, selectedNodeId, nodeStats],
  );

  // The canvas keeps its own copy so React Flow can record measurements on it.
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  useEffect(() => {
    setFlowNodes((prev) => {
      const measured = new Map(prev.map((n) => [n.id, n.measured]));
      return layout.nodes.map((n) => ({ ...n, measured: measured.get(n.id) ?? n.measured }));
    });
  }, [layout.nodes]);
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setFlowNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  // Fit once per loaded workflow (the store outlives the page).
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const fittedFor = useRef<string | null>(null);
  const firstId = nodes[0]?.id ?? null;
  useEffect(() => {
    if (!initialized || !firstId || fittedFor.current === firstId) return;
    fittedFor.current = firstId;
    fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.5 });
  }, [initialized, firstId, fitView]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (!selectedNodeId) return;
    const active = document.activeElement;
    if (active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || (active as HTMLElement)?.isContentEditable) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (node && node.type !== "trigger") setDeletingId(node.id);
  };

  const closeError = () => setValidationError(null);

  return (
    <BuilderProvider value={{ triggers, eventNames, fieldSuggestions, historyRetentionDays }}>
      <div className="flex h-full w-full overflow-hidden bg-[#fafafa]" onKeyDown={onKeyDown}>
        <div className="relative flex-1">
          <ReactFlow
            nodes={flowNodes}
            edges={layout.edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => {
              if (node.type !== PLACEHOLDER_TYPE) setSelectedNodeId(node.id);
            }}
            onPaneClick={() => setSelectedNodeId(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            panOnScroll
            minZoom={0.3}
            maxZoom={1.5}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            {/* Dots scale with zoom: a lighter or smaller dot vanishes on the #fafafa canvas once fitView zooms out. */}
            <Background variant={BackgroundVariant.Dots} gap={22} size={2} color="#b4b4bc" />
            <Controls position="bottom-left" showInteractive={false} className="sl-flow-controls" />
          </ReactFlow>
        </div>
        <SidePanel triggers={triggers} onDelete={setDeletingId} />

        <DeleteStepDialog nodeId={deletingId} onClose={() => setDeletingId(null)} />

        <Dialog
          isOpen={validationError !== null}
          onClose={closeError}
          title="Can't add this step"
          footer={<Button onClick={closeError}>Got it</Button>}
        >
          <p className="text-sm text-gray-500">{validationError}</p>
        </Dialog>
      </div>
    </BuilderProvider>
  );
};

export const AutomationBuilder = (props: Props) => (
  <ReactFlowProvider>
    <AutomationCanvas {...props} />
  </ReactFlowProvider>
);
