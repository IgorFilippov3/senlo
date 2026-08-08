"use client";

import { PageHeader } from "@senlo/ui";
import { ApiKeysList } from "@senlo/features";
import React from "react";
import { useParams } from "next/navigation";
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from "apps/web/queries/api-keys";
import { useCurrentWorkspace } from "../../layout";

export default function ApiKeysPage() {
  const params = useParams();
  const workspaceId = Number(params.id);
  const { workspace } = useCurrentWorkspace();

  const { data: keys = [], isLoading: keysLoading } = useApiKeys(
    workspaceId,
    !!workspaceId,
  );

  const createApiKeyMutation = useCreateApiKey();
  const deleteApiKeyMutation = useDeleteApiKey();

  const handleCreate = async (name: string) => {
    if (!workspaceId) return;

    createApiKeyMutation.mutate(
      { projectId: workspaceId, name },
      {
        onError: (error) => {
          alert(`Failed to create API key: ${error.message}`);
        },
      },
    );
  };

  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this API key? This action cannot be undone.",
      )
    )
      return;

    deleteApiKeyMutation.mutate(
      { apiKeyId: id, projectId: workspaceId },
      {
        onError: (error) => {
          alert(`Failed to delete API key: ${error.message}`);
        },
      },
    );
  };

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="API Keys"
        description={`Manage keys to authenticate your webhook requests for ${workspace?.name || "this workspace"}.`}
      />

      <div className="mt-8">
        <ApiKeysList
          keys={keys}
          isLoading={keysLoading}
          onCreateKey={handleCreate}
          onDeleteKey={handleDelete}
          isCreating={createApiKeyMutation.isPending}
          isDeleting={deleteApiKeyMutation.isPending}
        />
      </div>
    </main>
  );
}
