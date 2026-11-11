// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import {
  WORKFLOW_TEMPLATE_CATEGORIES,
  type WorkflowTemplate,
  type WorkflowTemplateCategory,
} from "@senlo/core";
import { Badge, Button, Card, Dialog, Input } from "@senlo/ui";
import { Check, Copy, Mail, Target, Zap } from "lucide-react";
import { FormErrorBanner } from "../shared";
import { LazyWorkflowPreview } from "./LazyWorkflowPreview";

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
      size="xl"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <LazyWorkflowPreview nodes={template.workflow.nodes} edges={template.workflow.edges} className="h-[460px]" />
        </div>

        <div className="space-y-3">
          <div className="space-y-1 text-xs text-gray-600">
            <Badge variant="outline" className="text-[10px]">
              {settings.kind ?? "transactional"}
            </Badge>
            {settings.goal && <p>Goal: <span className="font-mono">{settings.goal.event}</span></p>}
            <p>Entry: {entry}</p>
            <p className="text-gray-500">
              Email steps start empty: choose an email for each in the editor (a trigger with the same name is picked for you).
            </p>
          </div>
          <h4 className="text-sm font-semibold text-gray-900 pt-2">Your app sends</h4>
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
