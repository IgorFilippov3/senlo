import { describe, it, expect } from "vitest";
import { validateWorkflowGraph } from "../workflow-graph";

const edges = [
  { source: "t", target: "c" },
  { source: "c", target: "y", sourceHandle: "yes" },
  { source: "c", target: "n", sourceHandle: "no" },
];
const graph = (condition: Record<string, unknown>, trigger: Record<string, unknown> = { event: "x" }) => [
  { id: "t", type: "trigger", data: trigger },
  { id: "c", type: "condition", data: condition },
  { id: "y", type: "exit", data: {} },
  { id: "n", type: "exit", data: {} },
];
const reasons = (nodes: ReturnType<typeof graph>, e = edges) => {
  const check = validateWorkflowGraph(nodes, e);
  return check.valid ? [] : check.reasons;
};

describe("go-live checks of step settings", () => {
  it("a Condition needs a mode, a URL in API mode, valid rules in rules mode", () => {
    expect(reasons(graph({}))).toEqual(["Choose how a Condition decides: rules or your API."]);
    expect(reasons(graph({ mode: "api", url: " " }))).toEqual(["A Condition has no URL to call."]);
    expect(reasons(graph({ mode: "api", url: "https://x.io" }))).toEqual([]);
    expect(reasons(graph({ mode: "rules", conditions: { op: "and", rules: [] } }))).toEqual(["A group has no rules."]);
    expect(
      reasons(graph({ mode: "rules", conditions: { op: "and", rules: [{ source: "event", path: "reason", operator: "eq", value: "x" }] } })),
    ).toEqual([]);
  });

  it("an email rule must point at an email step of the automation", () => {
    const rules = (nodeId: string) => ({ mode: "rules", conditions: { op: "and", rules: [{ source: "email", nodeId, state: "opened" }] } });
    expect(reasons(graph(rules("y")))).toEqual(["An email rule refers to an email step that is not in this automation."]);
  });

  it("trigger filters are checked, and may read only the contact and the event", () => {
    const filters = { op: "and", rules: [{ source: "history", event: "x", did: true }] };
    expect(reasons(graph({ mode: "api", url: "https://x.io" }, { event: "x", filters }))).toEqual([
      "Trigger filters: A trigger filter can only check the contact or the event.",
    ]);
  });

  it("a Wait until needs a date field", () => {
    const nodes = [
      { id: "t", type: "trigger", data: { event: "x" } },
      { id: "w", type: "delay", data: { mode: "until", until: { source: "event", path: "" } } },
    ];
    expect(reasons(nodes as never, [{ source: "t", target: "w" }])).toEqual(["A Wait until step has no date field."]);
  });

  it("a Wait for event branches like a Condition and needs an event and a timeout", () => {
    const nodes = (data: Record<string, unknown>) => [
      { id: "t", type: "trigger", data: { event: "x" } },
      { id: "w", type: "wait_event", data },
      { id: "y", type: "exit", data: {} },
      { id: "n", type: "exit", data: {} },
    ];
    const branches = [
      { source: "t", target: "w" },
      { source: "w", target: "y", sourceHandle: "yes" },
      { source: "w", target: "n", sourceHandle: "no" },
    ];
    expect(reasons(nodes({ event: "paid", timeout: { duration: 3, unit: "days" } }) as never, branches)).toEqual([]);
    expect(reasons(nodes({}) as never, branches)).toEqual([
      "A Wait for event step needs a valid event name.",
      "A Wait for event step needs a timeout.",
    ]);
    // Without the No edge its exit is also left unconnected.
    expect(reasons(nodes({ event: "paid", timeout: { duration: 3, unit: "days" } }) as never, branches.slice(0, 2))).toEqual([
      "A Wait for event is missing a No branch.",
      "Some steps are not connected to the trigger.",
    ]);
  });
});
