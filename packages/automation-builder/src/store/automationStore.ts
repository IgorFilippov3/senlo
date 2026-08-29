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
import type { WorkflowNodeStats } from "@senlo/core";
import {
  validateAddChild,
  validateWorkflowConnection,
} from "../validation/workflowConnections";

export interface AutomationState {
  nodes: Node[];
  edges: Edge[];
  nodeStats: Record<string, WorkflowNodeStats>;
  selectedNodeId: string | null;
  validationError: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  setNodeStats: (stats: WorkflowNodeStats[]) => void;
  setValidationError: (error: string | null) => void;
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
  validationError: null,
  setValidationError: (error) => set({ validationError: error }),
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
    const result = validateWorkflowConnection(
      get().nodes,
      get().edges,
      connection,
    );
    if (!result.valid) {
      set({ validationError: result.reason });
      return;
    }

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
        // We will handle this in the UI via the addNode callback or state
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

    const result = validateAddChild(
      get().nodes,
      get().edges,
      parentId,
      type,
      sourceHandle,
    );
    if (!result.valid) {
      set({ validationError: result.reason });
      return;
    }

    const newNodeId = nanoid();
    const newNode: Node = {
      id: newNodeId,
      type,
      data: {},
      position: {
        x: parentNode.position.x,
        y: parentNode.position.y + 150,
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
