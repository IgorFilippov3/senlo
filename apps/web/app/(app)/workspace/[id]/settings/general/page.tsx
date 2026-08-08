"use client";

import { PageHeader } from "@senlo/ui";
import { WorkspaceSettings } from "@senlo/features";
import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useProject,
  useUpdateProject,
  useDeleteProject,
} from "apps/web/queries/projects";

export default function GeneralSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = Number(params.id);

  const { data: workspace, isLoading } = useProject(workspaceId);
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const handleUpdate = async (data: {
    name: string;
    description?: string | null;
  }) => {
    const formData = new FormData();
    formData.append("name", data.name);
    if (data.description) {
      formData.append("description", data.description);
    }

    updateMutation.mutate(
      { projectId: workspaceId, formData },
      {
        onSuccess: () => {
          // Success is handled by optimistic updates in the hook
        },
        onError: (error) => {
          alert(
            `Failed to update workspace: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      },
    );
  };

  const handleDelete = async () => {
    deleteMutation.mutate(workspaceId, {
      onSuccess: () => {
        router.push("/workspaces");
      },
      onError: (error) => {
        alert(`Failed to delete workspace: ${error.message}`);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-10 px-8">
        <div className="animate-pulse space-y-8">
          <div className="h-20 bg-zinc-100 rounded-xl w-full"></div>
          <div className="h-64 bg-zinc-100 rounded-xl w-full"></div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="max-w-7xl mx-auto py-10 px-8">
        <p>Workspace not found.</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="General Settings"
        description="Manage your workspace details and configuration."
      />

      <div className="mt-8">
        <WorkspaceSettings
          workspace={workspace}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isUpdating={updateMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </main>
  );
}
