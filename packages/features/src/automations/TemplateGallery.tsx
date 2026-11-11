// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import {
  WORKFLOW_TEMPLATE_CATEGORIES,
  type WorkflowExportEdge,
  type WorkflowExportNode,
  type WorkflowTemplate,
  type WorkflowTemplateCategory,
} from "@senlo/core";
import { Badge, Button, Card, Dialog, Input } from "@senlo/ui";
import { Check, Copy, Mail, Target, Zap } from "lucide-react";
import { FormErrorBanner } from "../shared";

const emailCount = (t: WorkflowTemplate) => t.workflow.nodes.filter((n) => n.type === "action").length;
const triggerEvent = (t: WorkflowTemplate) => t.events.find((e) => e.role === "trigger")?.name ?? "";

/** A template's card: what it is for, the event that starts it, emails, goal. */
function TemplateCard({ template, onOpen }: { template: WorkflowTemplate; onOpen: () => void }) {
  const emails = emailCount(template);
  return (
    <button type="button" onClick={onOpen} className="text-left h-full">
      <Card className="p-5 h-full border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{template.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{template.summary}</p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1 font-mono bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
            <Zap size={11} className="text-amber-600" />
            {triggerEvent(template)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Mail size={12} /> {emails} {emails === 1 ? "email" : "emails"}
          </span>
          {template.workflow.settings.goal && (
            <span className="inline-flex items-center gap-1">
              <Target size={12} /> goal
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}

/** Template cards, filtered by category (`showFilter`), or a fixed set without the filter. */
export function TemplateGallery({
  templates,
  onOpen,
  showFilter = true,
}: {
  templates: WorkflowTemplate[];
  onOpen: (template: WorkflowTemplate) => void;
  showFilter?: boolean;
}) {
  const [category, setCategory] = useState<WorkflowTemplateCategory | "all">("all");
  const shown = templates
    .filter((t) => category === "all" || t.category === category)
    .sort((a, b) => Number(!!b.popular) - Number(!!a.popular));

  return (
    <div className="space-y-4">
      {showFilter && (
        <div className="flex flex-wrap gap-2">
          {[{ id: "all" as const, label: "All" }, ...WORKFLOW_TEMPLATE_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                category === c.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map((t) => (
          <TemplateCard key={t.id} template={t} onOpen={() => onOpen(t)} />
        ))}
      </div>
    </div>
  );
}

const UNIT_SINGULAR: Record<string, string> = { minutes: "minute", hours: "hour", days: "day" };
const span = (n: number, unit: string) => `${n} ${n === 1 ? UNIT_SINGULAR[unit] ?? unit : unit}`;

/** One step as a line of the preview. */
export function describeTemplateStep(node: WorkflowExportNode): string {
  const d = node.data as Record<string, any>;
  switch (node.type) {
    case "trigger":
      return `Trigger: ${d.event}${d.tag ? ` (tag "${d.tag}")` : ""}`;
    case "action":
      return `Email: "${d.label ?? d.emailRef ?? "choose an email"}"`;
    case "delay":
      if (d.mode === "until") {
        const offset = d.until?.offset;
        const shift = offset ? ` ${offset.direction === "before" ? "−" : "+"} ${span(offset.duration, offset.unit)}` : "";
        return `Wait until ${d.until?.source}.${d.until?.path}${shift}`;
      }
      return `Wait ${span(Number(d.duration) || 1, d.unit ?? "days")}`;
    case "wait_event":
      return `Wait up to ${span(d.timeout?.duration, d.timeout?.unit)} for ${d.event}`;
    case "condition":
      return `Condition: ${d.label ?? "rules"}`;
    case "update_contact":
      return "Update contact";
    case "http_request":
      return `HTTP request: ${d.method ?? "POST"} ${d.url ?? ""}`.trim();
    case "exit":
      return "End";
    default:
      return node.type;
  }
}

/** The steps in graph order, each with the branch it is on ("If yes" / "If no"). */
function orderedSteps(nodes: WorkflowExportNode[], edges: WorkflowExportEdge[]) {
  const out: Array<{ node: WorkflowExportNode; depth: number; branch: string | null }> = [];
  const seen = new Set<string>();
  const visit = (id: string, depth: number, branch: string | null) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    out.push({ node, depth, branch });
    const outgoing = edges.filter((e) => e.source === id);
    for (const e of outgoing) {
      const branched = e.sourceHandle === "yes" || e.sourceHandle === "no";
      visit(e.target, branched ? depth + 1 : depth, branched ? e.sourceHandle : null);
    }
  };
  const root = nodes.find((n) => n.type === "trigger");
  if (root) visit(root.id, 0, null);
  return out;
}

/** An example request for an event of the template, to paste into the app. */
export function templateEventExample(name: string, payload?: Record<string, unknown>): string {
  const body = { event: name, email: "user@example.com", ...(payload ? { payload } : {}) };
  return `curl -X POST ${typeof window !== "undefined" ? window.location.origin : "https://senlo.io"}/api/events \\
  -H "Authorization: Bearer $SENLO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`;
}

const ROLE_LABELS = { trigger: "starts it", wait: "waited for", goal: "goal" } as const;

/** A template up close: its steps, settings and the events the app sends; "Use template" creates the draft. */
export function TemplatePreviewDialog({
  template,
  onClose,
  onUse,
  isCreating,
  error,
}: {
  template: WorkflowTemplate | null;
  onClose: () => void;
  onUse: (name: string) => void;
  isCreating?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  if (template && template.id !== lastId) {
    setLastId(template.id);
    setName(template.name);
    setCopied(null);
  }
  if (!template) return null;

  const { settings } = template.workflow;
  const entry = settings.entry?.mode === "once"
    ? "once per contact"
    : settings.entry?.mode === "restart"
      ? "restarts on a new event"
      : settings.entry?.cooldown
        ? `again after ${span(settings.entry.cooldown.duration, settings.entry.cooldown.unit)}`
        : "again after the previous run ends";

  const copy = async (eventName: string, payload?: Record<string, unknown>) => {
    await navigator.clipboard?.writeText(templateEventExample(eventName, payload)).catch(() => {});
    setCopied(eventName);
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={template.name}
      description={template.summary}
      className="max-w-3xl w-full"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onUse(name.trim() || template.name)} disabled={isCreating}>
            {isCreating ? "Creating..." : "Use template"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">Steps</h4>
            <Badge variant="outline" className="text-[10px]">
              {settings.kind ?? "transactional"}
            </Badge>
          </div>
          <ol className="space-y-1 text-sm text-gray-700">
            {orderedSteps(template.workflow.nodes, template.workflow.edges).map(({ node, depth, branch }) => (
              <li key={node.id} style={{ paddingLeft: depth * 16 }}>
                {branch && <span className="text-gray-400">{branch === "yes" ? "If yes: " : "If no: "}</span>}
                {describeTemplateStep(node)}
              </li>
            ))}
          </ol>
          <p className="text-xs text-gray-500">
            {settings.goal ? `Goal: ${settings.goal.event} · ` : ""}Entry: {entry}
          </p>
          <p className="text-xs text-gray-500">
            Email steps start empty; choose an email for each in the editor (a trigger with the same name is picked for you).
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">Your app sends</h4>
          <ul className="space-y-2">
            {template.events.map((e) => (
              <li key={e.name} className="border border-gray-200 rounded-lg p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-gray-900">{e.name}</span>
                  <span className="text-[11px] text-gray-500">{ROLE_LABELS[e.role]}</span>
                </div>
                {e.payload && (
                  <p className="font-mono text-[11px] text-gray-500 mt-1 break-all">
                    payload: {Object.keys(e.payload).join(", ")}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void copy(e.name, e.payload)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                >
                  {copied === e.name ? <Check size={11} /> : <Copy size={11} />}
                  {copied === e.name ? "Copied" : "Copy example request"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <label className="block space-y-1 mt-6">
        <span className="text-sm font-medium text-gray-900">Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="mt-3">
        <FormErrorBanner error={error} />
      </div>
    </Dialog>
  );
}
