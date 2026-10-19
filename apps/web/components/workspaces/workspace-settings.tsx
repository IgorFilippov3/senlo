"use client";

import { WorkspaceSettings as SharedWorkspaceSettings, useCurrentWorkspace } from "@senlo/features";
import { useDialogStore } from "apps/web/providers/dialogs/store";
import { useAiProviders } from "apps/web/queries/ai-providers";
import { useUpdateProject } from "apps/web/queries/projects";
import { useProviders } from "apps/web/queries/providers";
import { renderProvidersLink } from "./providers-link";

export function WorkspaceSettings() {
  const workspace = useCurrentWorkspace();
  const { data: providers = [], isLoading: providersLoading } = useProviders();
  const { data: aiProviders = [], isLoading: aiProvidersLoading } = useAiProviders();
  const update = useUpdateProject();
  const openDialog = useDialogStore((state) => state.open);

  if (providersLoading || aiProvidersLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-64 bg-zinc-100 rounded-xl w-full" />
        <div className="h-32 bg-zinc-100 rounded-xl w-full" />
      </div>
    );
  }

  return (
    <SharedWorkspaceSettings
      // A saved change resets the form to the stored values.
      key={workspace.updatedAt.toString()}
      workspace={workspace}
      emailProviders={providers}
      aiProviders={aiProviders}
      renderProvidersLink={renderProvidersLink}
      onSave={(values) => update.mutate({ projectId: workspace.id, values })}
      onDelete={() => openDialog("DELETE_WORKSPACE", { project: workspace })}
      isSaving={update.isPending}
      error={update.error?.message}
    />
  );
}
