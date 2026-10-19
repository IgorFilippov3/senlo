// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Structural rules for an automation graph: which connections the builder
 * may draw, and whether a whole graph can go live. Pure and isomorphic: the
 * builder checks as you draw, `WorkflowService` checks again before a
 * workflow is activated.
 */

export type GraphNodeRef = {
  id: string;
  type?: string | null;
};

export type GraphEdgeRef = {
  source: string;
  target: string;
  sourceHandle?: string | null;
};

export type ConnectionLike = {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
};

export type ConnectionValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export type GraphValidationResult =
  | { valid: true }
  | { valid: false; reasons: string[] };

const LINEAR_NODE_TYPES = new Set([
  "trigger",
  "action",
  "delay",
  "update_contact",
]);

const CONDITION_HANDLES = new Set(["yes", "no"]);

const VIRTUAL_CHILD_ID = "__virtual_child__";

export function normalizeHandle(handle?: string | null): string | null {
  if (!handle) return null;
  return handle;
}

export function hasOutgoingOnHandle(
  edges: GraphEdgeRef[],
  sourceId: string,
  sourceHandle?: string | null,
): boolean {
  return outgoingEdges(edges, sourceId, sourceHandle).length > 0;
}

function outgoingEdges(
  edges: GraphEdgeRef[],
  sourceId: string,
  sourceHandle?: string | null,
): GraphEdgeRef[] {
  const fromSource = edges.filter((edge) => edge.source === sourceId);
  const handle = normalizeHandle(sourceHandle);

  if (handle === "yes" || handle === "no") {
    return fromSource.filter(
      (edge) => normalizeHandle(edge.sourceHandle) === handle,
    );
  }

  return fromSource;
}

function incomingEdges(edges: GraphEdgeRef[], targetId: string): GraphEdgeRef[] {
  return edges.filter((edge) => edge.target === targetId);
}

function canReach(fromId: string, toId: string, edges: GraphEdgeRef[]): boolean {
  const seen = new Set<string>();
  const stack = [fromId];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === toId) return true;
    if (seen.has(id)) continue;
    seen.add(id);

    for (const edge of edges) {
      if (edge.source === id) {
        stack.push(edge.target);
      }
    }
  }

  return false;
}

function graphHasCycle(nodes: GraphNodeRef[], edges: GraphEdgeRef[]): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = outgoing.get(edge.source);
    if (targets) {
      targets.push(edge.target);
    } else {
      outgoing.set(edge.source, [edge.target]);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;

    visiting.add(id);
    for (const next of outgoing.get(id) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const node of nodes) {
    if (dfs(node.id)) return true;
  }

  return false;
}

function reachableFrom(startId: string, edges: GraphEdgeRef[]): Set<string> {
  const seen = new Set<string>([startId]);
  const queue = [startId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === id && !seen.has(edge.target)) {
        seen.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return seen;
}

/**
 * Whether a new edge can be added. Used by drag-connect, onConnect, and add-child.
 */
export function validateWorkflowConnection(
  nodes: GraphNodeRef[],
  edges: GraphEdgeRef[],
  connection: ConnectionLike,
): ConnectionValidationResult {
  const sourceId = connection.source;
  const targetId = connection.target;

  if (!sourceId || !targetId) {
    return { valid: false, reason: "Incomplete connection." };
  }

  if (sourceId === targetId) {
    return { valid: false, reason: "A step cannot connect to itself." };
  }

  const sourceNode = nodes.find((node) => node.id === sourceId);
  const targetNode = nodes.find((node) => node.id === targetId);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: "Unknown step." };
  }

  if (targetNode.type === "trigger") {
    return {
      valid: false,
      reason: "Trigger cannot have incoming connections.",
    };
  }

  if (sourceNode.type === "exit") {
    return { valid: false, reason: "Exit cannot have outgoing steps." };
  }

  const sourceHandle = normalizeHandle(connection.sourceHandle);

  const duplicate = edges.some(
    (edge) =>
      edge.source === sourceId &&
      edge.target === targetId &&
      normalizeHandle(edge.sourceHandle) === sourceHandle,
  );
  if (duplicate) {
    return { valid: false, reason: "These steps are already connected." };
  }

  if (sourceNode.type === "condition") {
    if (!sourceHandle || !CONDITION_HANDLES.has(sourceHandle)) {
      return {
        valid: false,
        reason: "API Check branches must use Yes or No.",
      };
    }

    if (outgoingEdges(edges, sourceId, sourceHandle).length >= 1) {
      return {
        valid: false,
        reason: "This branch already has a next step.",
      };
    }
  } else if (LINEAR_NODE_TYPES.has(sourceNode.type ?? "")) {
    if (outgoingEdges(edges, sourceId).length >= 1) {
      return {
        valid: false,
        reason: "This step already has a next step.",
      };
    }
  }

  if (canReach(targetId, sourceId, edges)) {
    return {
      valid: false,
      reason: "This connection would create a loop.",
    };
  }

  return { valid: true };
}

/**
 * Validate inserting a new child from the + button (target node does not exist yet).
 */
export function validateAddChild(
  nodes: GraphNodeRef[],
  edges: GraphEdgeRef[],
  parentId: string,
  childType: string,
  sourceHandle?: string | null,
): ConnectionValidationResult {
  if (childType === "trigger") {
    return {
      valid: false,
      reason: "Trigger must be the start of the workflow.",
    };
  }

  const virtualNodes: GraphNodeRef[] = [
    ...nodes,
    { id: VIRTUAL_CHILD_ID, type: childType },
  ];

  return validateWorkflowConnection(virtualNodes, edges, {
    source: parentId,
    target: VIRTUAL_CHILD_ID,
    sourceHandle: sourceHandle ?? null,
  });
}

/**
 * Full-graph checks for Go Live. Draft save is allowed to remain incomplete.
 */
export function validateWorkflowGraph(
  nodes: GraphNodeRef[],
  edges: GraphEdgeRef[],
): GraphValidationResult {
  const reasons: string[] = [];
  const triggers = nodes.filter((node) => node.type === "trigger");

  if (triggers.length === 0) {
    reasons.push("Add a trigger before going live.");
  } else if (triggers.length > 1) {
    reasons.push("Automation can only have one trigger.");
  }

  if (graphHasCycle(nodes, edges)) {
    reasons.push("This workflow contains a loop.");
  }

  for (const node of nodes) {
    const outgoing = outgoingEdges(edges, node.id);
    const incoming = incomingEdges(edges, node.id);

    if (node.type === "trigger" && incoming.length > 0) {
      reasons.push("Trigger cannot have incoming connections.");
    }

    if (node.type === "exit" && outgoing.length > 0) {
      reasons.push("Exit must be the end of a branch.");
    }

    if (LINEAR_NODE_TYPES.has(node.type ?? "") && outgoing.length > 1) {
      reasons.push("A step has more than one next step.");
    }

    if (node.type === "condition") {
      const yesEdges = outgoingEdges(edges, node.id, "yes");
      const noEdges = outgoingEdges(edges, node.id, "no");
      const invalidHandles = outgoing.filter((edge) => {
        const handle = normalizeHandle(edge.sourceHandle);
        return handle !== "yes" && handle !== "no";
      });

      if (invalidHandles.length > 0) {
        reasons.push("API Check branches must use Yes or No.");
      }
      if (yesEdges.length > 1 || noEdges.length > 1) {
        reasons.push("An API Check branch has more than one next step.");
      }
      if (yesEdges.length === 0) {
        reasons.push("An API Check is missing a Yes branch.");
      }
      if (noEdges.length === 0) {
        reasons.push("An API Check is missing a No branch.");
      }
    }
  }

  if (triggers.length === 1) {
    const reachable = reachableFrom(triggers[0].id, edges);
    const dangling = nodes.some((node) => !reachable.has(node.id));
    if (dangling) {
      reasons.push("Some steps are not connected to the trigger.");
    }
  }

  const unique = [...new Set(reasons)];
  if (unique.length > 0) {
    return { valid: false, reasons: unique };
  }

  return { valid: true };
}
