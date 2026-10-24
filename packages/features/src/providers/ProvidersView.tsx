"use client";

import React from "react";
import type { PublicAiProvider, PublicEmailProvider } from "@senlo/core";
import { Card, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@senlo/ui";
import { Cloud, Trash2, CheckCircle2, Circle, Bot, Plus, Pencil, AlertTriangle } from "lucide-react";
import { ErrorScreen } from "../shared/ErrorScreen";
import { PageSkeleton } from "../shared/Skeletons";
import { FormErrorBanner } from "../shared/FormErrorBanner";

interface ProviderCardProps {
  icon: React.ReactNode;
  name: string;
  isActive: boolean;
  createdAt: Date;
  details: React.ReactNode;
  /** Shown under the details, e.g. when the stored credentials cannot be read. */
  warning?: string;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

function ProviderCard({
  icon,
  name,
  isActive,
  createdAt,
  details,
  warning,
  onToggle,
  onDelete,
  onEdit,
}: ProviderCardProps) {
  return (
    <Card className="p-6 flex flex-col h-full group">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 bg-zinc-100 rounded-lg text-zinc-900">{icon}</div>
        <div className="flex items-center gap-2">
          <Badge variant={isActive ? "success" : "outline"}>{isActive ? "Active" : "Inactive"}</Badge>
          {onEdit && (
            <button
              onClick={onEdit}
              className="text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
              title="Edit settings"
            >
              <Pencil size={18} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <h3 className="font-bold text-lg text-zinc-900">{name}</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-6">{details}</p>
      {warning && (
        <p className="-mt-3 mb-6 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}

      <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between">
        <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
          Added {new Date(createdAt).toLocaleDateString("en-GB")}
        </div>
        <button
          onClick={onToggle}
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            isActive ? "text-zinc-400" : "text-blue-600"
          } hover:underline`}
        >
          {isActive ? (
            <>
              <Circle size={14} /> Deactivate
            </>
          ) : (
            <>
              <CheckCircle2 size={14} /> Set as active
            </>
          )}
        </button>
      </div>
    </Card>
  );
}

function EmptyProviders({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card className="col-span-full py-20 text-center border-dashed border-2">
      <div className="mx-auto text-zinc-300 mb-4 w-fit">{icon}</div>
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      <p className="text-zinc-500 max-w-sm mx-auto mt-2">{text}</p>
    </Card>
  );
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <>
    {label}: <span className="font-medium text-zinc-700">{value}</span>
  </>
);

export interface ProvidersViewProps {
  emailProviders: PublicEmailProvider[];
  aiProviders: PublicAiProvider[];
  isLoading?: boolean;
  /** Set when loading failed; replaces the lists. */
  error?: string | null;
  onRetry?: () => void;
  /** Why the last change on the page (a toggle) failed; shown above the lists. */
  actionError?: string | null;
  onAddEmailProvider: () => void;
  onEditEmailProvider: (provider: PublicEmailProvider) => void;
  onDeleteEmailProvider: (provider: PublicEmailProvider) => void;
  onToggleEmailProvider: (provider: PublicEmailProvider, isActive: boolean) => void;
  onAddAiProvider: () => void;
  onDeleteAiProvider: (provider: PublicAiProvider) => void;
  onToggleAiProvider: (provider: PublicAiProvider, isActive: boolean) => void;
}

/** The providers page: sending providers and AI model providers, one tab each. */
export function ProvidersView({
  emailProviders,
  aiProviders,
  isLoading,
  error,
  onRetry,
  actionError,
  onAddEmailProvider,
  onEditEmailProvider,
  onDeleteEmailProvider,
  onToggleEmailProvider,
  onAddAiProvider,
  onDeleteAiProvider,
  onToggleAiProvider,
}: ProvidersViewProps) {
  if (isLoading) {
    return <PageSkeleton variant="cards" />;
  }

  if (error) {
    return <ErrorScreen title="Failed to load providers" description={error} onRetry={onRetry} />;
  }

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <Tabs defaultValue="email">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-zinc-900">Providers</h1>
            <p className="text-zinc-500">Manage your email and AI service configurations.</p>
          </div>
          <TabsList className="mb-0 border-none">
            <TabsTrigger value="email">Email Services</TabsTrigger>
            <TabsTrigger value="ai">AI Models</TabsTrigger>
          </TabsList>
        </div>
        {actionError && (
          <div className="mb-6">
            <FormErrorBanner error={actionError} />
          </div>
        )}

        <TabsContent value="email">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Email Sending Providers</h2>
            <Button onClick={onAddEmailProvider}>
              <Plus size={16} />
              Add Provider
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {emailProviders.length === 0 ? (
              <EmptyProviders
                icon={<Cloud size={48} />}
                title="No email providers configured"
                text="Add your first email provider to start sending campaigns."
              />
            ) : (
              emailProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  icon={<Cloud size={24} />}
                  name={provider.name}
                  isActive={provider.isActive}
                  createdAt={provider.createdAt}
                  details={<Field label="Type" value={provider.type} />}
                  warning={
                    provider.configUnreadable
                      ? "Credentials can't be decrypted. Edit the provider and enter them again."
                      : undefined
                  }
                  onEdit={() => onEditEmailProvider(provider)}
                  onDelete={() => onDeleteEmailProvider(provider)}
                  onToggle={() => onToggleEmailProvider(provider, !provider.isActive)}
                />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">AI Model Providers</h2>
            <Button onClick={onAddAiProvider}>
              <Plus size={16} />
              Add AI Provider
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiProviders.length === 0 ? (
              <EmptyProviders
                icon={<Bot size={48} />}
                title="No AI providers configured"
                text="Configure OpenAI or Anthropic to enable AI template generation."
              />
            ) : (
              aiProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  icon={<Bot size={24} />}
                  name={provider.name}
                  isActive={provider.isActive}
                  createdAt={provider.createdAt}
                  details={
                    <>
                      <Field label="Type" value={provider.type} />
                      <br />
                      <Field label="Model" value={provider.config.model} />
                    </>
                  }
                  warning={
                    provider.configUnreadable
                      ? "API key can't be decrypted. Delete this provider and add it again."
                      : undefined
                  }
                  onDelete={() => onDeleteAiProvider(provider)}
                  onToggle={() => onToggleAiProvider(provider, !provider.isActive)}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
