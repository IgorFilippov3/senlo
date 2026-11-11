import { describe, it, expect } from "vitest";
import { previewGraph } from "../layout/previewGraph";
import { PLACEHOLDER_TYPE } from "../layout/layoutWorkflow";
import { STEP_NODE_TYPES } from "./nodes/nodeTypes";
import { STEP_META } from "./nodes/stepMeta";

const nodes = [
  { id: "t", type: "trigger", data: { event: "signed_up" } },
  { id: "w", type: "wait_event", data: { event: "project_created", timeout: { duration: 3, unit: "days" } } },
  { id: "end", type: "exit", data: {} },
  { id: "m", type: "action", data: { emailRef: "Need help?" } },
];

describe("workflow preview", () => {
  it("lays the graph out without + placeholders, from either edge shape", () => {
    const fromExport = previewGraph(nodes, [
      { source: "t", target: "w" },
      { source: "w", target: "end", sourceHandle: "yes" },
      { source: "w", target: "m", sourceHandle: "no" },
    ]);
    expect(fromExport.nodes.map((n) => n.id).sort()).toEqual(["end", "m", "t", "w"]);
    expect(fromExport.nodes.some((n) => n.type === PLACEHOLDER_TYPE)).toBe(false);
    expect(fromExport.edges.map((e) => e.data?.label ?? null)).toEqual([null, "Yes", "No"]);
    expect(fromExport.nodes.every((n) => n.selectable === false && n.draggable === false)).toBe(true);

    const stored = previewGraph(nodes, [{ sourceNodeId: "t", targetNodeId: "w" }]);
    expect(stored.edges).toHaveLength(1);
    expect(stored.edges[0]).toMatchObject({ source: "t", target: "w" });
  });

  it("has a card for every step type and names an exported email by its trigger name", () => {
    for (const type of ["trigger", "action", "delay", "condition", "wait_event", "update_contact", "http_request", "exit"]) {
      expect(STEP_NODE_TYPES).toHaveProperty(type);
    }
    expect(STEP_META.action.summary({ emailRef: "Need help?" }, { triggers: [] })).toEqual({ text: "Need help?" });
  });
});
