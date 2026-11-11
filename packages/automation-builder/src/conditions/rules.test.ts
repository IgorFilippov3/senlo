import { describe, it, expect } from "vitest";
import type { ConditionGroup } from "@senlo/core";
import {
  appendAt,
  countRules,
  describeGroup,
  describeRule,
  describeUntil,
  emptyGroup,
  fieldOptions,
  newRule,
  removeAt,
  replaceAt,
  withOperator,
  withSource,
} from "./rules";
import { conditionSummary, triggerSummary } from "../components/nodes/stepMeta";

const rule = (value: string) => ({ source: "event" as const, path: "reason", operator: "eq" as const, value });

describe("editing a group by path", () => {
  it("appends, replaces and removes rules and nested groups without touching the input", () => {
    const root = emptyGroup();
    const one = appendAt(root, [], rule("a"));
    const two = appendAt(one, [], { op: "or", rules: [rule("b")] });
    const three = appendAt(two, [1], rule("c"));

    expect(root.rules).toHaveLength(0);
    expect(three).toEqual({ op: "and", rules: [rule("a"), { op: "or", rules: [rule("b"), rule("c")] }] });
    expect(replaceAt(three, [1, 0], rule("B")).rules[1]).toEqual({ op: "or", rules: [rule("B"), rule("c")] });
    expect(removeAt(three, [1, 1])).toEqual({ op: "and", rules: [rule("a"), { op: "or", rules: [rule("b")] }] });
  });

  it("removing the last rule of a nested group removes the group", () => {
    const g: ConditionGroup = { op: "and", rules: [rule("a"), { op: "or", rules: [rule("b")] }] };
    expect(removeAt(g, [1, 0])).toEqual({ op: "and", rules: [rule("a")] });
  });

  it("a path that does not lead to a group changes nothing", () => {
    const g: ConditionGroup = { op: "and", rules: [rule("a")] };
    expect(appendAt(g, [0], rule("x"))).toBe(g);
  });
});

describe("rule edits", () => {
  it("new rules per source", () => {
    expect(newRule("history")).toEqual({ source: "history", event: "", did: true });
    expect(newRule("email", { emailNodeId: "m1" })).toEqual({ source: "email", nodeId: "m1", state: "opened" });
  });

  it("switching between contact and event keeps operator and value, other switches start fresh", () => {
    const r = { source: "contact" as const, path: "plan", operator: "neq" as const, value: "pro" };
    expect(withSource(r, "event")).toEqual({ source: "event", path: "", operator: "neq", value: "pro" });
    expect(withSource(r, "history")).toEqual({ source: "history", event: "", did: true });
    expect(withSource(r, "contact")).toBe(r);
  });

  it("a valueless operator drops the value; another brings an empty one back", () => {
    const r = withOperator(rule("x"), "exists");
    expect(r).toEqual({ source: "event", path: "reason", operator: "exists" });
    expect(withOperator(r, "eq")).toEqual({ source: "event", path: "reason", operator: "eq", value: "" });
  });

  it("field options: the contact's own fields, then attributes; payload keys for the event", () => {
    const s = { contact: ["plan", "email"], event: ["amount"] };
    expect(fieldOptions("contact", s)).toEqual(["email", "name", "locale", "unsubscribed", "tags", "plan"]);
    expect(fieldOptions("event", s)).toEqual(["amount"]);
    expect(fieldOptions("history", s)).toEqual([]);
  });
});

describe("descriptions", () => {
  it("describes rules", () => {
    expect(describeRule(rule("too_expensive"))).toBe('event.reason is "too_expensive"');
    expect(describeRule({ source: "contact", path: "plan", operator: "exists" })).toBe("contact.plan is set");
    expect(describeRule({ source: "event", path: "amount", operator: "gt", value: 100 })).toBe("event.amount is greater than 100");
    expect(describeRule({ source: "history", event: "project_created", did: false, withinDays: 3 })).toBe(
      "did not do project_created in 3 days",
    );
    expect(describeRule({ source: "email", nodeId: "m1", state: "not_opened" }, () => "Welcome")).toBe("Welcome was not opened");
  });

  it("describes groups and Wait until", () => {
    expect(describeGroup(undefined)).toBeNull();
    expect(describeGroup({ op: "and", rules: [rule("a")] })).toBe('event.reason is "a"');
    const nested: ConditionGroup = { op: "or", rules: [rule("a"), { op: "and", rules: [rule("b"), rule("c")] }] };
    expect(countRules(nested)).toBe(3);
    expect(describeGroup(nested)).toBe("3 rules, any must match");
    expect(describeUntil({ source: "event", path: "trial_ends_at", offset: { duration: 3, unit: "days", direction: "before" } })).toBe(
      "Until event.trial_ends_at − 3 days",
    );
    expect(describeUntil({ source: "contact", path: "renews_at" })).toBe("Until contact.renews_at");
    expect(describeUntil({ source: "event", path: "" })).toBeNull();
  });

  it("card lines of Condition and trigger steps", () => {
    expect(conditionSummary({ mode: "rules" })).toEqual({ text: "Set the rules", incomplete: true });
    expect(conditionSummary({ mode: "rules", conditions: { op: "and", rules: [rule("a")] } })).toEqual({ text: 'event.reason is "a"' });
    expect(conditionSummary({ mode: "api", url: "https://api.example.com/check" })).toEqual({ text: "api.example.com/check" });
    expect(triggerSummary({ event: "trial_started", filters: { op: "and", rules: [rule("a"), rule("b")] } })).toEqual({
      text: "trial_started, 2 filters",
    });
  });
});
