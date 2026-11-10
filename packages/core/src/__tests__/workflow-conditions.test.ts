import { describe, it, expect } from "vitest";
import {
  compare,
  evaluateConditions,
  lookupKey,
  lookupsOf,
  triggerAccepts,
  triggerFiltersOf,
  validateConditionGroup,
  type ConditionGroup,
  type ConditionSnapshot,
} from "../workflow-conditions";

const snapshot = (over: Partial<ConditionSnapshot> = {}): ConditionSnapshot => ({
  contact: { email: "Ann@X.io", name: "Ann", locale: "de", unsubscribed: false, meta: { plan: "pro", seats: "12", tags: ["vip", "beta"], company: { size: 40 } } },
  event: { reason: "too_expensive", amount: 42, trial_ends_at: "2026-12-01T00:00:00Z", items: [{ sku: "a" }] },
  steps: { c1: { status: 200, body: { plan: "team" } } },
  ...over,
});

describe("compare", () => {
  it.each([
    // [actual, operator, expected, result]
    [5, "eq", "5", true],
    ["5.0", "eq", 5, true],
    ["Pro", "eq", "pro", true],
    ["pro", "neq", "team", true],
    [10, "gt", "9", true],
    ["10", "gt", "9", true], // numerically, not as text
    ["b", "gt", "a", true],
    [3, "lte", 3, true],
    [3, "lt", 3, false],
    ["2026-12-01", "gt", "2026-11-30T23:00:00Z", true],
    ["2026-12-01T00:00:00Z", "eq", "2026-12-01T01:00:00+01:00", true],
    ["Hello World", "contains", "world", true],
    ["Hello", "not_contains", "bye", true],
    [["vip", "beta"], "contains", "VIP", true],
    [["vip", "beta"], "not_contains", "gold", true],
    [["vip", "beta"], "eq", "beta", true],
    [["vip"], "neq", "beta", true],
    ["de", "in", ["en", "de"], true],
    ["de", "in", "en, de", true],
    ["fr", "in", "en, de", false],
    [["vip"], "in", ["gold", "vip"], true],
    [true, "eq", "true", true],
    [0, "exists", undefined, true],
    ["", "exists", undefined, false],
    [[], "not_exists", undefined, true],
  ] as const)("%j %s %j -> %s", (actual, operator, expected, result) => {
    expect(compare(actual, operator, expected)).toBe(result);
  });

  it("a missing value satisfies only not_exists and neq", () => {
    for (const missing of [undefined, null, ""]) {
      expect(compare(missing, "not_exists")).toBe(true);
      expect(compare(missing, "neq", "x")).toBe(true);
      for (const op of ["eq", "contains", "not_contains", "gt", "gte", "lt", "lte", "in", "exists"] as const) {
        expect(compare(missing, op, "x"), `${String(missing)} ${op}`).toBe(false);
      }
    }
  });
});

describe("evaluateConditions", () => {
  it("reads the contact (fields, attributes, tags), the event and step outputs", () => {
    const s = snapshot();
    const check = (rules: ConditionGroup["rules"], op: "and" | "or" = "and") => evaluateConditions({ op, rules }, s);
    expect(check([{ source: "contact", path: "email", operator: "eq", value: "ann@x.io" }])).toBe(true);
    expect(check([{ source: "contact", path: "plan", operator: "eq", value: "pro" }])).toBe(true);
    expect(check([{ source: "contact", path: "meta.plan", operator: "eq", value: "pro" }])).toBe(true);
    expect(check([{ source: "contact", path: "meta.company.size", operator: "gte", value: 40 }])).toBe(true);
    expect(check([{ source: "contact", path: "tags", operator: "contains", value: "vip" }])).toBe(true);
    expect(check([{ source: "contact", path: "unsubscribed", operator: "eq", value: false }])).toBe(true);
    expect(check([{ source: "event", path: "reason", operator: "eq", value: "too_expensive" }])).toBe(true);
    expect(check([{ source: "event", path: "items.0.sku", operator: "eq", value: "a" }])).toBe(true);
    expect(check([{ source: "step", nodeId: "c1", path: "body.plan", operator: "eq", value: "team" }])).toBe(true);
    expect(check([{ source: "step", nodeId: "ghost", path: "body.plan", operator: "not_exists" }])).toBe(true);
  });

  it("combines with and / or, nested one level", () => {
    const yes = { source: "event" as const, path: "amount", operator: "gt" as const, value: 10 };
    const no = { source: "event" as const, path: "amount", operator: "lt" as const, value: 10 };
    expect(evaluateConditions({ op: "and", rules: [yes, no] }, snapshot())).toBe(false);
    expect(evaluateConditions({ op: "or", rules: [yes, no] }, snapshot())).toBe(true);
    expect(evaluateConditions({ op: "and", rules: [yes, { op: "or", rules: [no, yes] }] }, snapshot())).toBe(true);
    expect(evaluateConditions({ op: "and", rules: [] }, snapshot())).toBe(true);
  });

  it("history and email rules read the lookups; a missing answer is false", () => {
    const group: ConditionGroup = {
      op: "and",
      rules: [
        { source: "history", event: "project_created", did: false, withinDays: 3 },
        { source: "email", nodeId: "m1", state: "not_opened" },
      ],
    };
    expect(lookupsOf(group).map(lookupKey)).toEqual(["history:project_created:3", "email:m1:opened"]);
    expect(evaluateConditions(group, snapshot())).toBe(true);
    const lookups = new Map([["history:project_created:3", true]]);
    expect(evaluateConditions(group, snapshot({ lookups }))).toBe(false);
  });
});

describe("validateConditionGroup", () => {
  it("accepts a well-formed group", () => {
    const group: ConditionGroup = {
      op: "or",
      rules: [
        { source: "event", path: "reason", operator: "eq", value: "x" },
        { op: "and", rules: [{ source: "history", event: "logged_in", did: true, withinDays: 14 }, { source: "contact", path: "email", operator: "exists" }] },
      ],
    };
    expect(validateConditionGroup(group, "condition")).toEqual([]);
  });

  it("names what is wrong", () => {
    expect(validateConditionGroup(undefined, "condition")).toEqual(["Conditions are malformed."]);
    expect(validateConditionGroup({ op: "and", rules: [] }, "condition")).toEqual(["A group has no rules."]);
    expect(validateConditionGroup({ op: "and", rules: [{ source: "event", path: "", operator: "eq" }] }, "condition")).toEqual([
      "A rule has no field.",
      "A rule has no value to compare with.",
    ]);
    expect(validateConditionGroup({ op: "and", rules: [{ source: "history", event: "Bad Name", did: true, withinDays: 0 }] }, "condition")).toEqual([
      "A history rule needs a valid event name.",
      "A history rule's window must be a whole number of days.",
    ]);
    expect(validateConditionGroup({ op: "and", rules: [{ source: "email", nodeId: "x", state: "opened" }] }, "condition", { emailNodeIds: ["m1"] })).toEqual([
      "An email rule refers to an email step that is not in this automation.",
    ]);
    const deep = { op: "and", rules: [{ op: "and", rules: [{ op: "and", rules: [{ source: "contact", path: "email", operator: "exists" }] }] }] };
    expect(validateConditionGroup(deep, "condition")).toContain("Conditions are nested too deep.");
  });

  it("a trigger filter reads only the contact and the event", () => {
    expect(validateConditionGroup({ op: "and", rules: [{ source: "history", event: "x", did: true }] }, "trigger")).toEqual([
      "A trigger filter can only check the contact or the event.",
    ]);
  });
});

describe("trigger filters", () => {
  const contact = snapshot().contact;

  it("the tag shortcut and filters are one group", () => {
    expect(triggerFiltersOf({ event: "x" })).toBeNull();
    expect(triggerFiltersOf({ event: "tag_added", tag: " vip " })).toEqual({
      op: "and",
      rules: [{ source: "event", path: "tags", operator: "contains", value: "vip" }],
    });
  });

  it("a contact_updated trigger can watch one field's value", () => {
    const data = { event: "contact_updated", filters: { op: "and", rules: [{ source: "contact", path: "plan", operator: "eq", value: "pro" }] } };
    expect(triggerAccepts(data, { name: "contact_updated", payload: {} }, contact)).toBe(true);
    expect(triggerAccepts(data, { name: "contact_updated", payload: {} }, { ...contact, meta: { plan: "free" } })).toBe(false);
    expect(triggerAccepts(data, { name: "contact_added", payload: {} }, contact)).toBe(false);
  });

  it("a filter on the event payload", () => {
    const data = { event: "invoice_failed", filters: { op: "and", rules: [{ source: "event", path: "amount", operator: "gte", value: 100 }] } };
    expect(triggerAccepts(data, { name: "invoice_failed", payload: { amount: 150 } }, contact)).toBe(true);
    expect(triggerAccepts(data, { name: "invoice_failed", payload: { amount: 50 } }, contact)).toBe(false);
  });
});
