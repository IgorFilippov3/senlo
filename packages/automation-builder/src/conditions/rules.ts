import {
  VALUELESS_OPERATORS,
  isConditionGroup,
  type ConditionGroup,
  type ConditionPlace,
  type ConditionRule,
  type ConditionSource,
  type RuleOperator,
} from "@senlo/core";

/**
 * The rule builder's logic, apart from React: what a new rule looks like,
 * immutable edits by path, labels and the one-line descriptions on step
 * cards. Tested on its own (`rules.test.ts`).
 */

export const SOURCE_LABELS: Record<ConditionSource, string> = {
  contact: "Contact",
  event: "Trigger event",
  step: "Step output",
  history: "Contact history",
  email: "Email",
};

/** The sources the builder offers where. `step` waits for steps that produce output (phase 4/5). */
export const SOURCES_BY_PLACE: Record<ConditionPlace, ConditionSource[]> = {
  condition: ["contact", "event", "history", "email"],
  trigger: ["contact", "event"],
};

export const OPERATOR_LABELS: Record<RuleOperator, string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  not_contains: "does not contain",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  exists: "is set",
  not_exists: "is not set",
  in: "is one of",
};

export const EMAIL_STATE_LABELS = {
  opened: "was opened",
  not_opened: "was not opened",
  clicked: "was clicked",
  not_clicked: "was not clicked",
} as const;

/** Contact fields that are not attributes. */
export const CONTACT_FIELDS = ["email", "name", "locale", "unsubscribed", "tags"] as const;

export function emptyGroup(): ConditionGroup {
  return { op: "and", rules: [] };
}

/** A new rule of `source`, ready to be filled in. */
export function newRule(source: ConditionSource, options: { emailNodeId?: string } = {}): ConditionRule {
  switch (source) {
    case "contact":
      return { source, path: "", operator: "eq", value: "" };
    case "event":
      return { source, path: "", operator: "eq", value: "" };
    case "step":
      return { source, nodeId: "", path: "", operator: "eq", value: "" };
    case "history":
      return { source, event: "", did: true };
    case "email":
      return { source, nodeId: options.emailNodeId ?? "", state: "opened" };
  }
}

/** Where an item sits: indexes from the root group down. */
export type RulePath = number[];

/** The group at `path` replaced by `fn(group)`; the root when `path` is empty. */
export function updateGroupAt(
  root: ConditionGroup,
  path: RulePath,
  fn: (group: ConditionGroup) => ConditionGroup,
): ConditionGroup {
  if (path.length === 0) return fn(root);
  const [head, ...rest] = path;
  const child = root.rules[head];
  if (!child || !isConditionGroup(child)) return root;
  return { ...root, rules: root.rules.map((r, i) => (i === head ? updateGroupAt(child, rest, fn) : r)) };
}

/** The item at `path` (a rule or a group) replaced by `next`. */
export function replaceAt(root: ConditionGroup, path: RulePath, next: ConditionRule | ConditionGroup): ConditionGroup {
  if (path.length === 0) return isConditionGroup(next) ? next : root;
  const parent = path.slice(0, -1);
  const index = path[path.length - 1];
  return updateGroupAt(root, parent, (g) => ({ ...g, rules: g.rules.map((r, i) => (i === index ? next : r)) }));
}

/** The item at `path` removed; a nested group left empty goes too. */
export function removeAt(root: ConditionGroup, path: RulePath): ConditionGroup {
  if (path.length === 0) return root;
  const parent = path.slice(0, -1);
  const index = path[path.length - 1];
  const next = updateGroupAt(root, parent, (g) => ({ ...g, rules: g.rules.filter((_, i) => i !== index) }));
  if (parent.length > 0) {
    const group = parent.reduce<ConditionRule | ConditionGroup>((g, i) => (g as ConditionGroup).rules[i], next);
    if (isConditionGroup(group) && group.rules.length === 0) return removeAt(next, parent);
  }
  return next;
}

export function appendAt(root: ConditionGroup, path: RulePath, item: ConditionRule | ConditionGroup): ConditionGroup {
  return updateGroupAt(root, path, (g) => ({ ...g, rules: [...g.rules, item] }));
}

/** A rule's source changed: a fresh rule of the new source, keeping nothing that no longer fits. */
export function withSource(rule: ConditionRule, source: ConditionSource, options: { emailNodeId?: string } = {}): ConditionRule {
  if (rule.source === source) return rule;
  const fresh = newRule(source, options);
  if ("path" in rule && "path" in fresh && (source === "contact" || source === "event")) {
    return { ...fresh, operator: rule.operator, value: rule.value } as ConditionRule;
  }
  return fresh;
}

/** An operator changed: a valueless one drops the value. */
export function withOperator(rule: ConditionRule, operator: RuleOperator): ConditionRule {
  if (!("operator" in rule)) return rule;
  if (VALUELESS_OPERATORS.includes(operator)) {
    const { value: _dropped, ...rest } = rule;
    return { ...rest, operator } as ConditionRule;
  }
  return { ...rule, operator, value: rule.value ?? "" } as ConditionRule;
}

/** Field suggestions for a source: the contact's own fields first, then attributes seen in the project. */
export function fieldOptions(source: ConditionSource, suggestions: { contact: string[]; event: string[] }): string[] {
  if (source === "contact") {
    return [...CONTACT_FIELDS, ...suggestions.contact.filter((k) => !(CONTACT_FIELDS as readonly string[]).includes(k))];
  }
  if (source === "event") return suggestions.event;
  return [];
}

function shownValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

/** One line for a rule, as the step card and the summary show it. */
export function describeRule(rule: ConditionRule, stepLabel: (nodeId: string) => string = (id) => id): string {
  switch (rule.source) {
    case "contact":
    case "event":
    case "step": {
      const where = rule.source === "contact" ? "contact" : rule.source === "event" ? "event" : stepLabel(rule.nodeId);
      const field = rule.path || "…";
      const op = OPERATOR_LABELS[rule.operator] ?? rule.operator;
      return VALUELESS_OPERATORS.includes(rule.operator) ? `${where}.${field} ${op}` : `${where}.${field} ${op} ${shownValue(rule.value)}`;
    }
    case "history": {
      const window = rule.withinDays ? ` in ${rule.withinDays} ${rule.withinDays === 1 ? "day" : "days"}` : "";
      return `${rule.did ? "did" : "did not do"} ${rule.event || "…"}${window}`;
    }
    case "email":
      return `${stepLabel(rule.nodeId)} ${EMAIL_STATE_LABELS[rule.state]}`;
  }
}

/** Rules in a group, nested ones included. */
export function countRules(group: ConditionGroup): number {
  return group.rules.reduce((n, r) => n + (isConditionGroup(r) ? countRules(r) : 1), 0);
}

/** The card line of a rules-mode Condition (or a trigger's filters). */
export function describeGroup(group: ConditionGroup | undefined, stepLabel?: (nodeId: string) => string): string | null {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) return null;
  const count = countRules(group);
  const first = group.rules[0];
  if (count === 1 && !isConditionGroup(first)) return describeRule(first, stepLabel);
  return `${count} rules, ${group.op === "or" ? "any" : "all"} must match`;
}

const UNIT_SINGULAR: Record<string, string> = { minutes: "minute", hours: "hour", days: "day" };

/** The card line of a Wait until step. */
export function describeUntil(until: { source?: string; path?: string; offset?: { duration?: number; unit?: string; direction?: string } } | undefined): string | null {
  if (!until?.source || !until.path) return null;
  const base = `${until.source === "contact" ? "contact" : "event"}.${until.path}`;
  const n = Number(until.offset?.duration) || 0;
  if (!n) return `Until ${base}`;
  const unit = until.offset?.unit ?? "days";
  const units = n === 1 ? UNIT_SINGULAR[unit] ?? unit : unit;
  return `Until ${base} ${until.offset?.direction === "before" ? "−" : "+"} ${n} ${units}`;
}
