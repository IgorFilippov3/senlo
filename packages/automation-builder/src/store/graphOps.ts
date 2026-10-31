import type { Edge, Node } from "@xyflow/react";

/** Step types that can go in the middle of a chain (an End would cut it off). */
export const INSERTABLE_TYPES = ["action", "delay", "condition", "update_contact"] as const;

function reachable(startIds: string[], edges: Edge[]): Set<string> {
  const seen = new Set(startIds);
  const queue = [...startIds];
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
 * The steps deleting `id` takes with it. A step with one way out is cut out
 * and its parent joined to its child, so only the step itself goes. An API
 * check has two ways out and nothing to join them to, so its branches go
 * too, except steps another path still reaches.
 */
export function stepsRemovedBy(nodes: Node[], edges: Edge[], id: string): Set<string> {
  const node = nodes.find((n) => n.id === id);
  if (!node) return new Set();
  if (node.type !== "condition") return new Set([id]);

  const rest = edges.filter((e) => e.source !== id && e.target !== id);
  const roots = nodes
    .filter((n) => n.id !== id && (n.type === "trigger" || !edges.some((e) => e.target === n.id)))
    .map((n) => n.id);
  const kept = reachable(roots, rest);
  const removed = new Set([id]);
  for (const descendant of reachable([id], edges)) {
    if (!kept.has(descendant)) removed.add(descendant);
  }
  return removed;
}

export function deleteStep(
  nodes: Node[],
  edges: Edge[],
  id: string,
  newId: () => string,
): { nodes: Node[]; edges: Edge[] } {
  const removed = stepsRemovedBy(nodes, edges, id);
  const node = nodes.find((n) => n.id === id);
  const outgoing = edges.filter((e) => e.source === id);
  const kept = edges.filter((e) => !removed.has(e.source) && !removed.has(e.target));

  // Join the parent(s) to the only child, through the same handle as before.
  if (node && node.type !== "condition" && outgoing.length === 1) {
    const childId = outgoing[0].target;
    for (const incoming of edges.filter((e) => e.target === id)) {
      const handle = incoming.sourceHandle ?? null;
      const exists = kept.some(
        (e) => e.source === incoming.source && (e.sourceHandle ?? null) === handle,
      );
      if (!exists) {
        kept.push({ id: newId(), source: incoming.source, sourceHandle: handle, target: childId });
      }
    }
  }

  return { nodes: nodes.filter((n) => !removed.has(n.id)), edges: kept };
}

/**
 * Puts a new step in the middle of an edge. What came after continues from
 * the new step; after an API check it continues on Yes.
 */
export function insertStep(
  edges: Edge[],
  edgeId: string,
  node: Node,
  newId: () => string,
): Edge[] | null {
  const edge = edges.find((e) => e.id === edgeId);
  if (!edge) return null;
  return [
    ...edges.filter((e) => e.id !== edgeId),
    { id: newId(), source: edge.source, sourceHandle: edge.sourceHandle ?? null, target: node.id },
    {
      id: newId(),
      source: node.id,
      sourceHandle: node.type === "condition" ? "yes" : null,
      target: edge.target,
    },
  ];
}
