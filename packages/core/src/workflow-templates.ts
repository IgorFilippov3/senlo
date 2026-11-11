// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The template gallery (D10): reference automations a workspace starts from
 * in one click. Data, isomorphic: the gallery, the server that creates a
 * draft from one, and later the public template pages read the same list.
 *
 * Each is a workflow export (`workflow-export.ts`) without a source
 * workspace: email steps carry a suggested trigger name (`emailRef`, also
 * their label), matched to a trigger of that name when the workspace has
 * one, else left empty for the user to choose. `events` lists what the app
 * must send for the flow to work.
 */

import type { WorkflowSettings } from "./domain";
import type { ConditionGroup } from "./workflow-conditions";
import {
  WORKFLOW_EXPORT_FORMAT,
  WORKFLOW_EXPORT_VERSION,
  type WorkflowExport,
  type WorkflowExportEdge,
  type WorkflowExportNode,
} from "./workflow-export";

export type WorkflowTemplateCategory = "onboarding" | "billing" | "ecommerce" | "engagement";

export const WORKFLOW_TEMPLATE_CATEGORIES: Array<{ id: WorkflowTemplateCategory; label: string }> = [
  { id: "onboarding", label: "Onboarding" },
  { id: "billing", label: "Billing" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "engagement", label: "Engagement" },
];

/** An event the app sends for a template to work. */
export interface WorkflowTemplateEvent {
  name: string;
  /** What it does in the flow. */
  role: "trigger" | "wait" | "goal";
  /** Payload fields the flow reads (`{{event.*}}`, waits until a date). */
  payload?: Record<string, unknown>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  /** One line: what it is for. */
  summary: string;
  category: WorkflowTemplateCategory;
  /** Shown first, and on an empty automations list. */
  popular?: boolean;
  events: WorkflowTemplateEvent[];
  workflow: WorkflowExport;
}

const node = (id: string, type: string, data: Record<string, unknown> = {}): WorkflowExportNode => ({ id, type, data });
const edge = (source: string, target: string, sourceHandle: "yes" | "no" | null = null): WorkflowExportEdge => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle,
});
/** A linear run of steps: each to the next. */
const chain = (...ids: string[]): WorkflowExportEdge[] => ids.slice(1).map((id, i) => edge(ids[i], id));

const trigger = (event: string, extra: Record<string, unknown> = {}) => node("t", "trigger", { event, ...extra });
const email = (id: string, name: string) => node(id, "action", { label: name, emailRef: name });
const wait = (id: string, duration: number, unit: "minutes" | "hours" | "days") => node(id, "delay", { duration, unit });
const waitUntil = (id: string, path: string, days: number) =>
  node(id, "delay", {
    mode: "until",
    until: { source: "event", path, offset: { duration: days, unit: "days", direction: "before" } },
  });
const waitFor = (id: string, event: string, duration: number, unit: "minutes" | "hours" | "days") =>
  node(id, "wait_event", { event, timeout: { duration, unit } });
const rules = (id: string, conditions: ConditionGroup, label?: string) =>
  node(id, "condition", { mode: "rules", conditions, ...(label ? { label } : {}) });
const end = (id: string) => node(id, "exit");

const template = (
  t: Omit<WorkflowTemplate, "workflow"> & {
    settings: WorkflowSettings;
    nodes: WorkflowExportNode[];
    edges: WorkflowExportEdge[];
  },
): WorkflowTemplate => {
  const { settings, nodes, edges, ...meta } = t;
  return {
    ...meta,
    workflow: {
      format: WORKFLOW_EXPORT_FORMAT,
      version: WORKFLOW_EXPORT_VERSION,
      name: meta.name,
      description: meta.summary,
      settings,
      nodes,
      edges,
    },
  };
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  template({
    id: "welcome",
    name: "Welcome email",
    summary: "Greet every new contact the moment they sign up.",
    category: "onboarding",
    popular: true,
    events: [{ name: "contact_added", role: "trigger" }],
    settings: { entry: { mode: "once" } },
    nodes: [trigger("contact_added"), email("m1", "Welcome")],
    edges: chain("t", "m1"),
  }),
  template({
    id: "onboarding-activation",
    name: "Onboarding with activation check",
    summary: "Welcome new users, then nudge only those who have not created their first project.",
    category: "onboarding",
    popular: true,
    events: [
      { name: "signed_up", role: "trigger" },
      { name: "project_created", role: "goal" },
    ],
    settings: { kind: "lifecycle", goal: { event: "project_created" }, entry: { mode: "once" } },
    nodes: [
      trigger("signed_up"),
      email("m1", "Welcome"),
      waitFor("w1", "project_created", 3, "days"),
      end("done"),
      email("m2", "Need help getting started?"),
      wait("d1", 4, "days"),
      email("m3", "Your first project in 5 minutes"),
    ],
    edges: [...chain("t", "m1", "w1"), edge("w1", "done", "yes"), edge("w1", "m2", "no"), ...chain("m2", "d1", "m3")],
  }),
  template({
    id: "confirm-email",
    name: "Confirm email reminder",
    summary: "Remind users who have not confirmed their address, twice at most.",
    category: "onboarding",
    events: [
      { name: "signed_up", role: "trigger" },
      { name: "email_confirmed", role: "wait" },
    ],
    settings: { entry: { mode: "once" } },
    nodes: [
      trigger("signed_up"),
      waitFor("w1", "email_confirmed", 1, "days"),
      end("done1"),
      email("m1", "Please confirm your email"),
      waitFor("w2", "email_confirmed", 2, "days"),
      end("done2"),
      email("m2", "Last reminder: confirm your email"),
    ],
    edges: [
      edge("t", "w1"),
      edge("w1", "done1", "yes"),
      edge("w1", "m1", "no"),
      edge("m1", "w2"),
      edge("w2", "done2", "yes"),
      edge("w2", "m2", "no"),
    ],
  }),
  template({
    id: "invite-team",
    name: "Invite your team",
    summary: "Suggest inviting teammates when nobody was invited in the first days.",
    category: "onboarding",
    events: [
      { name: "project_created", role: "trigger" },
      { name: "member_invited", role: "wait" },
    ],
    settings: { kind: "lifecycle", entry: { mode: "once" } },
    nodes: [trigger("project_created"), waitFor("w1", "member_invited", 3, "days"), end("done"), email("m1", "Invite your team")],
    edges: [edge("t", "w1"), edge("w1", "done", "yes"), edge("w1", "m1", "no")],
  }),
  template({
    id: "trial-ending",
    name: "Trial ending",
    summary: "Remind users before their trial ends; stop as soon as they pay.",
    category: "billing",
    popular: true,
    events: [
      { name: "trial_started", role: "trigger", payload: { trial_ends_at: "2026-12-01T00:00:00Z" } },
      { name: "subscription_started", role: "goal" },
    ],
    settings: { kind: "lifecycle", goal: { event: "subscription_started" }, entry: { mode: "once" } },
    nodes: [
      trigger("trial_started"),
      waitUntil("d1", "trial_ends_at", 3),
      email("m1", "Your trial ends in 3 days"),
      waitUntil("d2", "trial_ends_at", 1),
      email("m2", "Last day of your trial"),
    ],
    edges: chain("t", "d1", "m1", "d2", "m2"),
  }),
  template({
    id: "dunning",
    name: "Failed payment (dunning)",
    summary: "Recover failed payments with three reminders; stop when the invoice is paid.",
    category: "billing",
    popular: true,
    events: [
      { name: "payment_failed", role: "trigger", payload: { amount: "29.00", update_url: "https://app.example.com/billing" } },
      { name: "payment_succeeded", role: "goal" },
    ],
    settings: { kind: "transactional", goal: { event: "payment_succeeded" } },
    nodes: [
      trigger("payment_failed"),
      email("m1", "Your payment failed"),
      wait("d1", 3, "days"),
      email("m2", "Reminder: update your card"),
      wait("d2", 4, "days"),
      email("m3", "Final notice before your plan is paused"),
    ],
    edges: chain("t", "m1", "d1", "m2", "d2", "m3"),
  }),
  template({
    id: "renewal-reminder",
    name: "Renewal reminder",
    summary: "Tell customers a week before their annual plan renews.",
    category: "billing",
    events: [{ name: "renewal_scheduled", role: "trigger", payload: { renews_at: "2027-01-15T00:00:00Z", amount: "290.00" } }],
    settings: { kind: "transactional" },
    nodes: [trigger("renewal_scheduled"), waitUntil("d1", "renews_at", 7), email("m1", "Your plan renews in 7 days")],
    edges: chain("t", "d1", "m1"),
  }),
  template({
    id: "usage-threshold",
    name: "Usage limit upsell",
    summary: "Suggest an upgrade when a customer nears their plan's limit, at most once a month.",
    category: "billing",
    events: [
      { name: "usage_threshold_reached", role: "trigger", payload: { percent: 80, limit: 10000 } },
      { name: "plan_upgraded", role: "goal" },
    ],
    settings: {
      kind: "lifecycle",
      goal: { event: "plan_upgraded" },
      entry: { mode: "after_exit", cooldown: { duration: 30, unit: "days" } },
    },
    nodes: [trigger("usage_threshold_reached"), email("m1", "You've used 80% of your plan"), wait("d1", 3, "days"), email("m2", "More room with the next plan")],
    edges: chain("t", "m1", "d1", "m2"),
  }),
  template({
    id: "review-request",
    name: "Review request",
    summary: "Ask for a review a week after an order; skip it once they leave one.",
    category: "ecommerce",
    events: [
      { name: "order_created", role: "trigger", payload: { order_id: "1042", product_name: "Desk lamp" } },
      { name: "review_submitted", role: "goal" },
    ],
    settings: { kind: "lifecycle", goal: { event: "review_submitted" } },
    nodes: [trigger("order_created"), wait("d1", 7, "days"), email("m1", "How do you like your order?")],
    edges: chain("t", "d1", "m1"),
  }),
  template({
    id: "abandoned-checkout",
    name: "Abandoned checkout",
    summary: "Bring back shoppers who started a checkout and did not finish it.",
    category: "ecommerce",
    popular: true,
    events: [
      { name: "checkout_started", role: "trigger", payload: { cart_url: "https://shop.example.com/cart/abc", total: 59 } },
      { name: "order_completed", role: "goal" },
    ],
    settings: {
      kind: "lifecycle",
      goal: { event: "order_completed" },
      entry: { mode: "after_exit", cooldown: { duration: 1, unit: "days" } },
    },
    nodes: [
      trigger("checkout_started"),
      waitFor("w1", "order_completed", 1, "hours"),
      end("done"),
      email("m1", "You left something in your cart"),
      wait("d1", 1, "days"),
      email("m2", "Still thinking it over?"),
    ],
    edges: [edge("t", "w1"), edge("w1", "done", "yes"), edge("w1", "m1", "no"), ...chain("m1", "d1", "m2")],
  }),
  template({
    id: "re-activation",
    name: "Re-activation after 14 days idle",
    summary: "Write to users who have not logged in for two weeks; every login starts the wait over.",
    category: "engagement",
    events: [{ name: "logged_in", role: "trigger" }],
    settings: { kind: "lifecycle", entry: { mode: "restart" } },
    nodes: [trigger("logged_in"), wait("d1", 14, "days"), email("m1", "We miss you")],
    edges: chain("t", "d1", "m1"),
  }),
  template({
    id: "win-back",
    name: "Win-back after cancel",
    summary: "Reach out a week after a cancellation, with an offer when price was the reason.",
    category: "engagement",
    events: [
      { name: "subscription_canceled", role: "trigger", payload: { reason: "too_expensive" } },
      { name: "subscription_started", role: "goal" },
    ],
    settings: { kind: "lifecycle", goal: { event: "subscription_started" } },
    nodes: [
      trigger("subscription_canceled"),
      wait("d1", 7, "days"),
      rules("c1", { op: "and", rules: [{ source: "event", path: "reason", operator: "eq", value: "too_expensive" }] }, "Left because of the price?"),
      email("m1", "A discount to come back"),
      email("m2", "What's new since you left"),
    ],
    edges: [...chain("t", "d1", "c1"), edge("c1", "m1", "yes"), edge("c1", "m2", "no")],
  }),
  template({
    id: "nurture-by-tag",
    name: "Nurture new leads",
    summary: "A short sequence for contacts tagged as leads, with a follow-up for those who did not open.",
    category: "engagement",
    events: [{ name: "tag_added", role: "trigger", payload: { tags: ["lead"] } }],
    settings: { kind: "lifecycle", entry: { mode: "once" } },
    nodes: [
      trigger("tag_added", { tag: "lead" }),
      email("m1", "Getting started guide"),
      wait("d1", 3, "days"),
      rules("c1", { op: "and", rules: [{ source: "email", nodeId: "m1", state: "not_opened" }] }, "Guide not opened?"),
      email("m2", "In case you missed it"),
      email("m3", "How teams like yours use us"),
    ],
    edges: [...chain("t", "m1", "d1", "c1"), edge("c1", "m2", "yes"), edge("c1", "m3", "no")],
  }),
  template({
    id: "milestone",
    name: "Milestone celebration",
    summary: "Congratulate users when they reach a milestone in your product.",
    category: "engagement",
    events: [{ name: "milestone_reached", role: "trigger", payload: { milestone: "1,000 emails sent" } }],
    settings: { kind: "transactional" },
    nodes: [trigger("milestone_reached"), email("m1", "Congrats on your milestone")],
    edges: chain("t", "m1"),
  }),
];

export function findWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
