import React, { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  ReactFlowProvider,
  OnSelectionChangeParams,
  useReactFlow,
  getOutgoers,
  Connection,
  Edge,
  Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles.css";
import { useAutomationStore } from "../store/automationStore";
import { TriggerNode } from "./nodes/TriggerNode";
import { ActionNode } from "./nodes/ActionNode";
import { DelayNode } from "./nodes/DelayNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { SidePanel } from "./SidePanel";
import { Mail, Clock, GitBranch, Zap, Plus } from "lucide-react";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  delay: DelayNode,
  condition: ConditionNode,
};

interface Trigger {
  id: number;
  name: string;
}

interface Props {
  triggers?: Trigger[];
  stats?: import("@senlo/core").WorkflowNodeStats[];
}

export const AutomationCanvas = ({ triggers = [], stats = [] }: Props) => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    addNode,
    deleteNode,
    selectedNodeId,
    setNodeStats,
  } = useAutomationStore();

  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();

  const statsString = JSON.stringify(stats);

  React.useEffect(() => {
    setNodeStats(stats);
  }, [statsString, setNodeStats]);

  const onSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams) => {
      setSelectedNodeId(nodes.length === 1 ? nodes[0].id : null);
    },
    [setSelectedNodeId],
  );

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      // Prevent self-connection
      if (connection.source === connection.target) return false;

      const nodes = getNodes();
      const edges = getEdges();

      const target = nodes.find((node) => node.id === connection.target);

      // Check if connection would create a cycle
      const hasCycle = (node: Node, visited = new Set()) => {
        if (visited.has(node.id)) return false;
        visited.add(node.id);

        for (const outgoer of getOutgoers(node, nodes, edges)) {
          if (outgoer.id === connection.source) return true;
          if (hasCycle(outgoer, visited)) return true;
        }

        return false;
      };

      if (target) {
        return !hasCycle(target);
      }

      return true;
    },
    [getNodes, getEdges],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedNodeId
      ) {
        // Don't delete if user is typing in an input
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        deleteNode(selectedNodeId);
      }
    },
    [selectedNodeId, deleteNode],
  );

  const onAddNode = (type: string) => {
    // Add node near the center of the view
    addNode(type, { x: 300, y: 200 });
  };

  return (
    <div
      className="flex h-full w-full overflow-hidden bg-white"
      onKeyDown={onKeyDown}
    >
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={["Delete", "Backspace"]}
        >
          <Background color="#ccc" gap={20} />
          <Controls />
          <Panel
            position="top-left"
            className="bg-white p-2 rounded-xl border border-gray-200 shadow-lg flex flex-col gap-2 ml-4 mt-4"
          >
            <div className="px-2 py-1 mb-1 border-b border-gray-100 flex items-center gap-2">
              <Plus size={14} className="text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Add Nodes
              </span>
            </div>
            <button
              onClick={() => onAddNode("action")}
              className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-lg group transition-colors text-left"
              title="Add Email Action"
            >
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Mail size={16} />
              </div>
              <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-700">
                Send Email
              </span>
            </button>
            <button
              onClick={() => onAddNode("delay")}
              className="flex items-center gap-3 p-2 hover:bg-purple-50 rounded-lg group transition-colors text-left"
              title="Add Time Delay"
            >
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-md border border-purple-100 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Clock size={16} />
              </div>
              <span className="text-xs font-semibold text-gray-700 group-hover:text-purple-700">
                Wait Delay
              </span>
            </button>
            <button
              onClick={() => onAddNode("condition")}
              className="flex items-center gap-3 p-2 hover:bg-green-50 rounded-lg group transition-colors text-left"
              title="Add API Check"
            >
              <div className="p-1.5 bg-green-50 text-green-600 rounded-md border border-green-100 group-hover:bg-green-600 group-hover:text-white transition-colors">
                <GitBranch size={16} />
              </div>
              <span className="text-xs font-semibold text-gray-700 group-hover:text-green-700">
                API Check
              </span>
            </button>
          </Panel>
        </ReactFlow>
      </div>
      <SidePanel triggers={triggers} />
    </div>
  );
};

export const AutomationBuilder = ({ triggers, stats }: Props) => {
  return (
    <ReactFlowProvider>
      <AutomationCanvas triggers={triggers} stats={stats} />
    </ReactFlowProvider>
  );
};
