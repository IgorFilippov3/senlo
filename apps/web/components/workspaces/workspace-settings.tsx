"use client";

import {
  WorkspaceSettings as SharedWorkspaceSettings,
  useCurrentWorkspace,
  useAiProviders,
  useUpdateProject,
  useProviders,
} from "@senlo/features";
import { useSenloDialogs as useDialogs } from "@senlo/features";
import { renderProvidersLink } from "./providers-link";

export function WorkspaceSettings() {
  const workspace = useCurrentWorkspace();
  const { data: providers = [], isLoading: providersLoading } = useProviders();
  const { data: aiProviders = [], isLoading: aiProvidersLoading } = useAiProviders();
  const update = useUpdateProject();
  const { open: openDialog } = useDialogs();

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
