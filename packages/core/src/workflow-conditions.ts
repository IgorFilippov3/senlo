// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Conditions on a contact, the run's trigger event, step outputs and the
 * contact's history: the rules of a Condition step and a trigger's filters.
 * Pure and isomorphic, like `workflow-graph.ts`: the worker evaluates, the
 * builder and `WorkflowService` validate with the same code.
 *
 * Evaluation is synchronous over a snapshot. The two sources that need the
 * database (`history`, `email`) are listed by `lookupsOf`, answered by the
 * worker, and passed in as `lookups`.
 */

import { isValidEventName, type WorkflowEvent } from "./workflow-events";

export const RULE_OPERATORS = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "exists",
  "not_exists",
  "in",
] as const;
export type RuleOperator = (typeof RULE_OPERATORS)[number];

/** Operators that take no value. */
export const VALUELESS_OPERATORS: readonly RuleOperator[] = ["exists", "not_exists"];

export type ConditionRule =
  /** `email`, `name`, `locale`, `unsubscribed`, `tags`, `meta.<key>` (a bare `<key>` reads `meta.<key>`). */
  | { source: "contact"; path: string; operator: RuleOperator; value?: unknown }
  /** The trigger event's payload. */
  | { source: "event"; path: string; operator: RuleOperator; value?: unknown }
  /** A step's output (HTTP body, a waited event's payload). */
  | { source: "step"; nodeId: string; path: string; operator: RuleOperator; value?: unknown }
  /** Whether the contact did `event` (ever, or in the last `withinDays` days; within the event log's retention). */
  | { source: "history"; event: string; did: boolean; withinDays?: number }
  /** Whether the email of an email step was opened / clicked. */
  | { source: "email"; nodeId: string; state: "opened" | "not_opened" | "clicked" | "not_clicked" };

export interface ConditionGroup {
  op: "and" | "or";
  rules: Array<ConditionRule | ConditionGroup>;
}

export type ConditionSource = ConditionRule["source"];

/** What the in-memory sources read. */
export interface ConditionSnapshot {
  contact: {
    email: string;
    name?: string | null;
    locale?: string | null;
    unsubscribed?: boolean;
    meta?: Record<string, unknown> | null;
  };
  /** The trigger event's payload. */
  event: Record<string, unknown>;
  /** Step outputs by node id. */
  steps: Record<string, unknown>;
  /** Answers to `lookupsOf`, by `lookupKey`. A missing answer counts as false. */
  lookups?: ReadonlyMap<string, boolean>;
}

export type LookupRule = Extract<ConditionRule, { source: "history" | "email" }>;

export function isConditionGroup(value: ConditionRule | ConditionGroup): value is ConditionGroup {
  return typeof value === "object" && value !== null && "rules" in value;
}

/** The key a lookup's answer is stored under. */
export function lookupKey(rule: LookupRule): string {
  return rule.source === "history"
    ? `history:${rule.event}:${rule.withinDays ?? "ever"}`
    : `email:${rule.nodeId}:${rule.state.startsWith("not_") ? rule.state.slice(4) : rule.state}`;
}

/** The rules that need the database, once each by `lookupKey`. */
export function lookupsOf(group: ConditionGroup): LookupRule[] {
  const found = new Map<string, LookupRule>();
  const walk = (g: ConditionGroup) => {
    for (const r of g.rules) {
      if (isConditionGroup(r)) walk(r);
      else if (r.source === "history" || r.source === "email") found.set(lookupKey(r), r);
    }
  };
  walk(group);
  return [...found.values()];
}

/** Whether the group holds for the snapshot. An empty group holds. */
export function evaluateConditions(group: ConditionGroup, snapshot: ConditionSnapshot): boolean {
  const results = group.rules.map((r) => (isConditionGroup(r) ? evaluateConditions(r, snapshot) : evaluateRule(r, snapshot)));
  return group.op === "or" ? results.length === 0 || results.some(Boolean) : results.every(Boolean);
}

export function evaluateRule(rule: ConditionRule, snapshot: ConditionSnapshot): boolean {
  switch (rule.source) {
    case "contact":
      return compare(contactValue(snapshot.contact, rule.path), rule.operator, rule.value);
    case "event":
      return compare(valueAt(snapshot.event, rule.path), rule.operator, rule.value);
    case "step":
      return compare(valueAt(snapshot.steps[rule.nodeId], rule.path), rule.operator, rule.value);
    case "history": {
      const did = snapshot.lookups?.get(lookupKey(rule)) ?? false;
      return rule.did ? did : !did;
    }
    case "email": {
      const happened = snapshot.lookups?.get(lookupKey(rule)) ?? false;
      return rule.state.startsWith("not_") ? !happened : happened;
    }
  }
}

const CONTACT_FIELDS = new Set(["email", "name", "locale", "unsubscribed"]);

/** A contact field by path, as a `contact` rule reads it. */
export function contactValue(contact: ConditionSnapshot["contact"], path: string): unknown {
  const meta = contact.meta ?? {};
  const [head, ...rest] = path.split(".");
  if (CONTACT_FIELDS.has(head) && rest.length === 0) return (contact as Record<string, unknown>)[head];
  if (head === "tags") return valueAt(meta, path);
  if (head === "meta") return valueAt(meta, rest.join("."));
  return valueAt(meta, path);
}

/** The value at a dotted path; own properties only. An empty path is the value itself. */
export function valueAt(source: unknown, path: string): unknown {
  if (path === "") return source;
  let current: unknown = source;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const isMissing = (v: unknown) => v === undefined || v === null || v === "";

/**
 * One comparison. Numbers compare numerically when both sides read as
 * numbers, ISO dates as dates, anything else as case-insensitive text. A
 * missing value (absent, null, empty text) satisfies only `not_exists` and
 * `neq`. On a list (tags), `eq` and `in` hold when one element does,
 * `contains` looks for an element.
 */
export function compare(actual: unknown, operator: RuleOperator, expected?: unknown): boolean {
  if (operator === "exists") return !isMissing(actual) && !(Array.isArray(actual) && actual.length === 0);
  if (operator === "not_exists") return isMissing(actual) || (Array.isArray(actual) && actual.length === 0);
  if (isMissing(actual)) return operator === "neq";

  switch (operator) {
    case "eq":
      return Array.isArray(actual) ? actual.some((a) => same(a, expected)) : same(actual, expected);
    case "neq":
      return Array.isArray(actual) ? !actual.some((a) => same(a, expected)) : !same(actual, expected);
    case "contains":
      return contains(actual, expected);
    case "not_contains":
      return !contains(actual, expected);
    case "in": {
      const options = listOf(expected);
      const values = Array.isArray(actual) ? actual : [actual];
      return values.some((a) => options.some((o) => same(a, o)));
    }
    case "gt":
      return order(actual, expected) > 0;
    case "gte":
      return order(actual, expected) >= 0;
    case "lt":
      return order(actual, expected) < 0;
    case "lte":
      return order(actual, expected) <= 0;
  }
}

function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) return actual.some((a) => same(a, expected));
  if (typeof actual === "object") return false;
  return text(actual).includes(text(expected));
}

/** `in` takes a list, or text split on commas. */
function listOf(expected: unknown): unknown[] {
  if (Array.isArray(expected)) return expected;
  if (typeof expected === "string") return expected.split(",").map((s) => s.trim()).filter((s) => s !== "");
  return expected === undefined ? [] : [expected];
}

const NUMBER = /^-?\d+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && NUMBER.test(v.trim())) return Number(v.trim());
  return null;
}

/** Milliseconds of an ISO date (or a `Date`), or null. */
export function asDate(v: unknown): number | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "string" && ISO_DATE.test(v.trim())) {
    const ms = Date.parse(v.trim());
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function text(v: unknown): string {
  return typeof v === "object" && v !== null ? JSON.stringify(v).toLowerCase() : String(v).toLowerCase();
}

function same(a: unknown, b: unknown): boolean {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na === nb;
  const da = asDate(a);
  const db = asDate(b);
  if (da !== null && db !== null) return da === db;
  return text(a) === text(b);
}

/** <0, 0, >0. */
function order(a: unknown, b: unknown): number {
  const na = asNumber(a);
  const nb = asNumber(b);
  if (na !== null && nb !== null) return na - nb;
  const da = asDate(a);
  const db = asDate(b);
  if (da !== null && db !== null) return da - db;
  return text(a).localeCompare(text(b));
}

/** Where a group is used: a trigger's filters read only the contact and the event. */
export type ConditionPlace = "condition" | "trigger";

const SOURCES: Record<ConditionPlace, readonly ConditionSource[]> = {
  condition: ["contact", "event", "step", "history", "email"],
  trigger: ["contact", "event"],
};

/** The deepest nesting the builder offers: a group of rules and groups of rules. */
export const MAX_CONDITION_DEPTH = 2;

/**
 * What is wrong with a stored group, as messages for the user; empty when
 * it is fine. `emailNodeIds`: the email steps a rule may refer to.
 */
export function validateConditionGroup(
  value: unknown,
  place: ConditionPlace,
  options: { emailNodeIds?: readonly string[]; stepNodeIds?: readonly string[] } = {},
): string[] {
  const problems: string[] = [];
  const walk = (g: unknown, depth: number) => {
    if (!g || typeof g !== "object" || !Array.isArray((g as ConditionGroup).rules)) {
      problems.push("Conditions are malformed.");
      return;
    }
    const group = g as ConditionGroup;
    if (group.op !== "and" && group.op !== "or") problems.push('A group must match "all" or "any" of its rules.');
    if (depth > MAX_CONDITION_DEPTH) problems.push("Conditions are nested too deep.");
    if (group.rules.length === 0) problems.push("A group has no rules.");
    for (const r of group.rules) {
      if (r && typeof r === "object" && "rules" in r) walk(r, depth + 1);
      else problems.push(...ruleProblems(r as ConditionRule, place, options));
    }
  };
  walk(value, 1);
  return [...new Set(problems)];
}

function ruleProblems(
  rule: ConditionRule,
  place: ConditionPlace,
  { emailNodeIds, stepNodeIds }: { emailNodeIds?: readonly string[]; stepNodeIds?: readonly string[] },
): string[] {
  if (!rule || typeof rule !== "object" || !SOURCES[place].includes(rule.source)) {
    return [place === "trigger" ? "A trigger filter can only check the contact or the event." : "A rule has an unknown source."];
  }
  switch (rule.source) {
    case "contact":
    case "event":
    case "step": {
      const problems: string[] = [];
      if (typeof rule.path !== "string" || rule.path.trim() === "") problems.push("A rule has no field.");
      if (!RULE_OPERATORS.includes(rule.operator)) problems.push("A rule has an unknown operator.");
      else if (!VALUELESS_OPERATORS.includes(rule.operator) && isMissing(rule.value)) {
        problems.push("A rule has no value to compare with.");
      }
      if (rule.source === "step" && (typeof rule.nodeId !== "string" || (stepNodeIds && !stepNodeIds.includes(rule.nodeId)))) {
        problems.push("A rule reads a step that is not in this automation.");
      }
      return problems;
    }
    case "history": {
      const problems: string[] = [];
      if (typeof rule.event !== "string" || !isValidEventName(rule.event)) problems.push("A history rule needs a valid event name.");
      if (typeof rule.did !== "boolean") problems.push('A history rule must say "did" or "did not".');
      if (rule.withinDays !== undefined && (!Number.isInteger(rule.withinDays) || rule.withinDays < 1)) {
        problems.push("A history rule's window must be a whole number of days.");
      }
      return problems;
    }
    case "email": {
      const problems: string[] = [];
      if (!["opened", "not_opened", "clicked", "not_clicked"].includes(rule.state)) problems.push("An email rule has an unknown state.");
      if (typeof rule.nodeId !== "string" || (emailNodeIds && !emailNodeIds.includes(rule.nodeId))) {
        problems.push("An email rule refers to an email step that is not in this automation.");
      }
      return problems;
    }
  }
}

/**
 * A trigger's filters as one group: its `filters`, and for a `tag_added`
 * trigger with a `tag`, "the event's tags contain it". Null when there are
 * none.
 */
export function triggerFiltersOf(data: Record<string, unknown>): ConditionGroup | null {
  const rules: Array<ConditionRule | ConditionGroup> = [];
  if (data.event === "tag_added" && typeof data.tag === "string" && data.tag.trim() !== "") {
    rules.push({ source: "event", path: "tags", operator: "contains", value: data.tag.trim() });
  }
  const filters = data.filters as ConditionGroup | undefined;
  if (filters && typeof filters === "object" && Array.isArray(filters.rules) && filters.rules.length > 0) {
    rules.push(filters);
  }
  return rules.length > 0 ? { op: "and", rules } : null;
}

/**
 * Whether a trigger node's data accepts the event for this contact: the
 * name must be equal, then its filters (`triggerFiltersOf`) must hold on
 * the contact and the event's payload.
 */
export function triggerAccepts(
  data: Record<string, unknown>,
  event: WorkflowEvent,
  contact: ConditionSnapshot["contact"],
): boolean {
  if (data.event !== event.name) return false;
  const filters = triggerFiltersOf(data);
  return filters === null || evaluateConditions(filters, { contact, event: event.payload, steps: {} });
}
