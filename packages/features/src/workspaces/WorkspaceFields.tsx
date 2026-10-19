"use client";

import React from "react";
import type { Project, PublicAiProvider, PublicEmailProvider } from "@senlo/core";
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@senlo/ui";

/** What the edit dialog and the settings page send. */
export interface WorkspaceFormValues {
  name: string;
  description: string;
  providerId: number | null;
  aiProviderId: number | null;
}

export function workspaceFormValues(workspace: Project): WorkspaceFormValues {
  return {
    name: workspace.name,
    description: workspace.description ?? "",
    providerId: workspace.providerId ?? null,
    aiProviderId: workspace.aiProviderId ?? null,
  };
}

export function isWorkspaceFormChanged(workspace: Project, values: WorkspaceFormValues): boolean {
  const saved = workspaceFormValues(workspace);
  return (
    values.name !== saved.name ||
    values.description !== saved.description ||
    values.providerId !== saved.providerId ||
    values.aiProviderId !== saved.aiProviderId
  );
}

export interface WorkspaceFieldsProps {
  values: WorkspaceFormValues;
  onChange: (values: WorkspaceFormValues) => void;
  emailProviders: PublicEmailProvider[];
  aiProviders: PublicAiProvider[];
  /** Link to the providers page, shown when a list is empty. */
  renderProvidersLink: (children: React.ReactNode) => React.ReactNode;
  autoFocus?: boolean;
}

const NONE = "none";
const toSelect = (id: number | null) => (id === null ? NONE : String(id));
const fromSelect = (value: string) => (value === NONE ? null : Number(value));

function ProviderSelect({
  value,
  onChange,
  noneLabel,
  providers,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  noneLabel: string;
  providers: { id: number; name: string; type: string }[];
}) {
  return (
    <Select value={toSelect(value)} onValueChange={(v) => onChange(fromSelect(v))}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={noneLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {providers.map((p) => (
          <SelectItem key={p.id} value={String(p.id)}>
            {p.name} ({p.type})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NoProvidersHint({
  kind,
  renderProvidersLink,
}: {
  kind: string;
  renderProvidersLink: WorkspaceFieldsProps["renderProvidersLink"];
}) {
  return (
    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
      No {kind} providers configured yet. Go to {renderProvidersLink("Providers")} to add one.
    </p>
  );
}

/** Name, description and the two provider pickers; controlled. */
export function WorkspaceFields({
  values,
  onChange,
  emailProviders,
  aiProviders,
  renderProvidersLink,
  autoFocus,
}: WorkspaceFieldsProps) {
  const set = (patch: Partial<WorkspaceFormValues>) => onChange({ ...values, ...patch });

  return (
    <div className="space-y-4">
      <FormField label="Workspace Name" required>
        <Input
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. My SaaS Launch"
          required
          autoFocus={autoFocus}
        />
      </FormField>

      <FormField label="Description (optional)">
        <Textarea
          value={values.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="What is this workspace for?"
          rows={3}
        />
      </FormField>

      <FormField
        label="Email Provider"
        hint="Used for every trigger and automation in this workspace. Without one, sending is disabled."
      >
        <ProviderSelect
          value={values.providerId}
          onChange={(providerId) => set({ providerId })}
          noneLabel="None (sending disabled)"
          providers={emailProviders}
        />
      </FormField>
      {emailProviders.length === 0 && (
        <NoProvidersHint kind="email" renderProvidersLink={renderProvidersLink} />
      )}

      <FormField label="AI Provider" hint="Used for AI template generation in this workspace.">
        <ProviderSelect
          value={values.aiProviderId}
          onChange={(aiProviderId) => set({ aiProviderId })}
          noneLabel="None"
          providers={aiProviders}
        />
      </FormField>
      {aiProviders.length === 0 && (
        <NoProvidersHint kind="AI" renderProvidersLink={renderProvidersLink} />
      )}
    </div>
  );
}
