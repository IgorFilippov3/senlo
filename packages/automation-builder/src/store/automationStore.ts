import { create } from "zustand";
import {
  Connection,
  Edge,
  Node,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { WorkflowNodeStats } from "@senlo/core";

export interface AutomationState {
  nodes: Node[];
  edges: Edge[];
  nodeStats: Record<string, WorkflowNodeStats>;
  selectedNodeId: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setNodeStats: (stats: WorkflowNodeStats[]) => void;
  addNode: (
    type: string,
    position?: { x: number; y: number },
    data?: any,
  ) => void;
  deleteNode: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateNodeData: (id: string, data: any) => void;
  addChildNode: (parentId: string, type: string, sourceHandle?: string) => void;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  nodes: [],
  edges: [],
  nodeStats: {},
  selectedNodeId: null,
  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setNodeStats: (stats) => {
    const currentStats = get().nodeStats;
    const statsMap: Record<string, WorkflowNodeStats> = {};
    let hasChanged = false;

    stats.forEach((s) => {
      statsMap[s.nodeId] = s;
      if (
        !currentStats[s.nodeId] ||
        JSON.stringify(currentStats[s.nodeId]) !== JSON.stringify(s)
      ) {
        hasChanged = true;
      }
    });

    // Also check if some stats were removed
    if (!hasChanged && Object.keys(currentStats).length !== stats.length) {
      hasChanged = true;
    }

    if (hasChanged) {
      set({ nodeStats: statsMap });
    }
  },
  addNode: (type, position, data = {}) => {
    if (type === "trigger") {
      const hasTrigger = get().nodes.some((n) => n.type === "trigger");
      if (hasTrigger) {
        alert("Automation can only have one trigger.");
        return;
      }
    }

    const newNode: Node = {
      id: nanoid(),
      type,
      data,
      position: position || { x: 250, y: 150 },
    };
    set({
      nodes: [...get().nodes, newNode],
    });
  },
  addChildNode: (parentId, type, sourceHandle) => {
    const parentNode = get().nodes.find((n) => n.id === parentId);
    if (!parentNode) return;

    const newNodeId = nanoid();
    const newNode: Node = {
      id: newNodeId,
      type,
      data: {},
      position: {
        x: parentNode.position.x,
        y: parentNode.position.y + 150, // Position below parent
      },
    };

    const newEdge: Edge = {
      id: nanoid(),
      source: parentId,
      target: newNodeId,
      sourceHandle: sourceHandle || null,
    };

    set({
      nodes: [...get().nodes, newNode],
      edges: [...get().edges, newEdge],
    });
  },
  deleteNode: (id) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== id),
      edges: get().edges.filter(
        (edge) => edge.source !== id && edge.target !== id,
      ),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
  },
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    });
  },
}));
