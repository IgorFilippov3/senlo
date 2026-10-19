"use client";

import React, { useState } from "react";
import { Button, Card, FormField, Input, Textarea, JsonEditor, PageHeader, Badge } from "@senlo/ui";
import type { EmailTemplate } from "@senlo/core";
import { FormErrorBanner } from "../shared";
import { ChevronRight, ChevronLeft, Check, Settings, Layout, Send } from "lucide-react";

export interface TriggerWizardValues {
  name: string;
  description: string;
  templateId: number;
  fromName: string;
  fromEmail: string;
  /** Sample JSON as typed; the server parses and validates it. */
  variablesSchema: string;
}

export interface TriggerWizardProps {
  /** Workspace the trigger is created in, shown on the review step. */
  projectName?: string;
  templates: EmailTemplate[];
  isLoadingTemplates?: boolean;
  onSubmit: (values: TriggerWizardValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  /** Shown above the buttons, e.g. a validation message from the server. */
  error?: string | null;
}

type Step = "setup" | "content" | "review";

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: "setup", label: "Setup", icon: <Settings size={18} /> },
  { id: "content", label: "Content", icon: <Layout size={18} /> },
  { id: "review", label: "Review", icon: <Send size={18} /> },
];

export function TriggerWizard({
  projectName,
  templates,
  isLoadingTemplates = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  error,
}: TriggerWizardProps) {
  const [step, setStep] = useState<Step>("setup");
  const [form, setForm] = useState({
    name: "",
    description: "",
    templateId: null as number | null,
    fromName: "",
    fromEmail: "",
    variablesSchema: "",
  });

  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const currentTemplate = templates.find((t) => t.id === form.templateId);
  const canContinue =
    (step === "setup" && !!form.name) || (step === "content" && form.templateId !== null);

  const handleSubmit = () => {
    if (form.templateId === null) return;
    onSubmit({ ...form, templateId: form.templateId });
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader title="Create New Trigger" description="Configure your email trigger." />

      <div className="flex items-center justify-between mb-10 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 -translate-y-1/2 -z-10" />
        {STEPS.map((s, idx) => {
          const isActive = step === s.id;
          const isCompleted = stepIndex > idx;

          return (
            <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive
                    ? "border-blue-600 bg-blue-50 text-blue-600 shadow-md"
                    : isCompleted
                      ? "border-green-500 bg-green-50 text-green-500"
                      : "border-zinc-200 bg-white text-zinc-400"
                }`}
              >
                {isCompleted ? <Check size={20} /> : s.icon}
              </div>
              <span className={`text-xs font-medium ${isActive ? "text-blue-600" : "text-zinc-500"}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <Card className="p-8">
        {step === "setup" && (
          <div className="space-y-8">
            <FormField label="Trigger Name" required hint="Internal name for your email trigger">
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Welcome Email"
              />
            </FormField>

            <FormField
              label="Sample JSON Data"
              hint="Provide a sample JSON object to define variables for the editor"
            >
              <JsonEditor
                value={form.variablesSchema}
                onChange={(val) => update("variablesSchema", val)}
                height="160px"
              />
            </FormField>

            <FormField label="Description (optional)">
              <Textarea
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="e.g. Sent when a new user signs up..."
                rows={3}
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="From Name" hint="How you'll appear in the inbox">
                <Input
                  value={form.fromName}
                  onChange={(e) => update("fromName", e.target.value)}
                  placeholder="e.g. Igor from Senlo"
                />
              </FormField>
              <FormField label="From Email" hint="The email address to send from">
                <Input
                  value={form.fromEmail}
                  onChange={(e) => update("fromEmail", e.target.value)}
                  placeholder="e.g. hello@senlo.io"
                />
              </FormField>
            </div>
          </div>
        )}

        {step === "content" && (
          <div className="space-y-6">
            <FormField label="Select Template" required hint="Choose the design for this trigger">
              {isLoadingTemplates ? (
                <div className="py-8 text-center text-zinc-500">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">
                  No templates found in this project.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => update("templateId", t.id)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${
                        form.templateId === t.id
                          ? "border-blue-600 bg-blue-50 shadow-sm"
                          : "border-zinc-200 hover:border-zinc-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="font-medium text-sm">{t.name}</h4>
                        <Badge
                          variant="outline"
                          className="bg-white text-[9px] font-bold uppercase tracking-wider text-zinc-500 border-zinc-200 py-0 px-1.5 h-4"
                        >
                          {t.locale}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{t.subject}</p>
                    </div>
                  ))}
                </div>
              )}
            </FormField>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Settings
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Name:</span>
                    <span className="font-medium">{form.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Workspace:</span>
                    <span className="font-medium">{projectName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">From:</span>
                    <span className="font-medium">
                      {form.fromName || "Default"} ({form.fromEmail || "Default"})
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                  Content
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-zinc-500">Template:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{currentTemplate?.name}</span>
                      {currentTemplate && (
                        <Badge
                          variant="outline"
                          className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500 border-zinc-200"
                        >
                          {currentTemplate.locale}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
              <div className="mt-0.5 text-blue-600">
                <Settings size={18} />
              </div>
              <p className="text-sm text-blue-800">
                Ready to go! Once you create this email trigger, you will receive a{" "}
                <strong>Webhook URL</strong> to start sending from your backend.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8">
            <FormErrorBanner error={error} />
          </div>
        )}

        <div className="flex justify-between items-center mt-10 pt-6 border-t border-zinc-100">
          <Button
            variant="ghost"
            onClick={step === "setup" ? onCancel : () => setStep(STEPS[stepIndex - 1].id)}
            disabled={isSubmitting}
          >
            <ChevronLeft size={16} />
            {step === "setup" ? "Cancel" : "Back"}
          </Button>

          {step === "review" ? (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Trigger"}
              <Check size={16} />
            </Button>
          ) : (
            <Button onClick={() => setStep(STEPS[stepIndex + 1].id)} disabled={!canContinue}>
              Next Step
              <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
