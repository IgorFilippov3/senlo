import { isBranchingType } from "@senlo/core";
import type { Edge, Node } from "@xyflow/react";

/**
 * Where every step sits on the canvas, computed from the graph's structure
 * alone: steps are not dragged, and positions are not stored. The flow is a
 * tree hanging from the trigger, top to bottom; an API check splits into a
 * Yes column (left) and a No column (right). Every open slot (the end of a
 * chain, an empty branch) gets a `+` placeholder to add the next step.
 *
 * Steps have fixed sizes (the node components match them), so the layout
 * needs no measuring pass.
 */

export const STEP_WIDTH = 280;
export const STEP_HEIGHT = 64;
export const STATS_HEIGHT = 28;
export const END_WIDTH = 96;
export const END_HEIGHT = 36;
export const PLACEHOLDER_SIZE = 28;

const COLUMN_GAP = 48;
const ROOT_GAP = 120;
/** Between a step and the next one: room for the edge's insert button. */
const STEP_GAP = 56;
/** Between an API check and its branches: room for the split and the Yes/No label. */
export const BRANCH_GAP = 132;
/** Where the branch edges split, below the API check. */
export const BRANCH_SPLIT = 32;

export const PLACEHOLDER_TYPE = "placeholder";
export const EDGE_TYPE = "workflow";

export type BranchLabel = "Yes" | "No";

export interface WorkflowEdgeData extends Record<string, unknown> {
  /** Set on the edges leaving an API check. */
  label?: BranchLabel;
  /** Real edges can take a step inserted in their middle; placeholder edges cannot. */
  insertable: boolean;
}

export interface PlaceholderData extends Record<string, unknown> {
  parentId: string;
  sourceHandle: string | null;
}

interface Slot {
  handle: string | null;
  label?: BranchLabel;
}

type Item =
  | { kind: "step"; node: Node; width: number; height: number; slots: { slot: Slot; child: Item | null }[] }
  | { kind: "placeholder"; id: string; parentId: string; slot: Slot };

function slotsOf(node: Node): Slot[] {
  if (node.type === "exit") return [];
  if (isBranchingType(node.type)) {
    return [
      { handle: "yes", label: "Yes" },
      { handle: "no", label: "No" },
    ];
  }
  return [{ handle: null }];
}

function sizeOf(node: Node, hasStats: boolean): { width: number; height: number } {
  if (node.type === "exit") return { width: END_WIDTH, height: END_HEIGHT };
  return { width: STEP_WIDTH, height: STEP_HEIGHT + (hasStats ? STATS_HEIGHT : 0) };
}

function edgeForSlot(node: Node, slot: Slot, outgoing: Edge[]): Edge | undefined {
  if (isBranchingType(node.type)) return outgoing.find((e) => e.sourceHandle === slot.handle);
  return outgoing[0];
}

export interface LayoutOptions {
  selectedId?: string | null;
  /** Steps that show a stats strip (and are taller for it). */
  withStats?: Set<string>;
  /** `+` placeholders at open ends (the editor); a preview leaves them out. */
  placeholders?: boolean;
}

export function layoutWorkflow(
  nodes: Node[],
  edges: Edge[],
  { selectedId = null, withStats = new Set(), placeholders = true }: LayoutOptions = {},
): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, Edge[]>();
  const hasIncoming = new Set<string>();
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
    hasIncoming.add(edge.target);
  }

  const visited = new Set<string>();

  const build = (node: Node): Item => {
    visited.add(node.id);
    const out = outgoing.get(node.id) ?? [];
    const slots = slotsOf(node).map((slot) => {
      const edge = edgeForSlot(node, slot, out);
      if (!edge) {
        if (!placeholders) return { slot, child: null };
        const id = `__add__:${node.id}:${slot.handle ?? "next"}`;
        return { slot, child: { kind: "placeholder", id, parentId: node.id, slot } as Item };
      }
      const target = byId.get(edge.target)!;
      // A step reached twice (an older graph that merges branches) is drawn
      // once, where it was reached first; the second edge still points at it.
      return { slot, child: visited.has(target.id) ? null : build(target) };
    });
    return { kind: "step", node, ...sizeOf(node, withStats.has(node.id)), slots };
  };

  // The trigger first, then anything not hanging from it (older graphs).
  const roots: Item[] = [];
  const ordered = [
    ...nodes.filter((n) => n.type === "trigger"),
    ...nodes.filter((n) => n.type !== "trigger" && !hasIncoming.has(n.id)),
    ...nodes,
  ];
  for (const node of ordered) {
    if (!visited.has(node.id)) roots.push(build(node));
  }

  const widths = new Map<Item, number>();
  const columnWidth = (item: Item): number => {
    const cached = widths.get(item);
    if (cached !== undefined) return cached;
    let width = STEP_WIDTH;
    if (item.kind === "step") {
      const children = item.slots.flatMap((s) => (s.child ? [s.child] : []));
      if (children.length > 0) {
        const sum = children.reduce((acc, c) => acc + columnWidth(c), 0);
        width = Math.max(width, sum + COLUMN_GAP * (children.length - 1));
      }
    }
    widths.set(item, width);
    return width;
  };

  const outNodes: Node[] = [];
  const outEdges: Edge[] = [];

  const place = (item: Item, centerX: number, top: number) => {
    if (item.kind === "placeholder") {
      outNodes.push({
        id: item.id,
        type: PLACEHOLDER_TYPE,
        position: { x: centerX - PLACEHOLDER_SIZE / 2, y: top },
        width: PLACEHOLDER_SIZE,
        height: PLACEHOLDER_SIZE,
        data: { parentId: item.parentId, sourceHandle: item.slot.handle } satisfies PlaceholderData,
        draggable: false,
        selectable: false,
        focusable: false,
      });
      outEdges.push({
        id: `${item.id}:edge`,
        source: item.parentId,
        sourceHandle: item.slot.handle,
        target: item.id,
        type: EDGE_TYPE,
        data: { label: item.slot.label, insertable: false } satisfies WorkflowEdgeData,
      });
      return;
    }

    const { node, width, height } = item;
    outNodes.push({
      ...node,
      position: { x: centerX - width / 2, y: top },
      width,
      height,
      draggable: false,
      selected: node.id === selectedId,
    });

    const children = item.slots.flatMap((s) => (s.child ? [s.child] : []));
    if (children.length === 0) return;
    const gap = isBranchingType(node.type) ? BRANCH_GAP : STEP_GAP;
    const childTop = top + height + gap;
    const total = children.reduce((acc, c) => acc + columnWidth(c), 0) + COLUMN_GAP * (children.length - 1);
    let left = centerX - total / 2;
    for (const child of children) {
      const w = columnWidth(child);
      place(child, left + w / 2, childTop);
      left += w + COLUMN_GAP;
    }
  };

  let left = 0;
  for (const root of roots) {
    const w = columnWidth(root);
    place(root, left + w / 2, 0);
    left += w + ROOT_GAP;
  }

  for (const edge of edges) {
    const source = byId.get(edge.source);
    if (!source || !byId.has(edge.target)) continue;
    const isBranch = isBranchingType(source.type);
    const handle = isBranch ? edge.sourceHandle : null;
    outEdges.push({
      ...edge,
      // Only an API check has named handles; older graphs may carry one elsewhere.
      sourceHandle: handle ?? null,
      type: EDGE_TYPE,
      data: {
        label: handle === "yes" ? "Yes" : handle === "no" ? "No" : undefined,
        insertable: true,
      } satisfies WorkflowEdgeData,
    });
  }

  return { nodes: outNodes, edges: outEdges };
}
