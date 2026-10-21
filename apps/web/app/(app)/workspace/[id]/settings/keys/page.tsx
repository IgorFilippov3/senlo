"use client";

import { PageHeader } from "@senlo/ui";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import type { IssuedApiKey } from "@senlo/core";
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
  ApiKeysList,
  useCurrentWorkspace,
} from "@senlo/features";

export default function ApiKeysPage() {
  const params = useParams();
  const workspaceId = Number(params.id);
  const workspace = useCurrentWorkspace();

  const { data: keys = [], isLoading: keysLoading } = useApiKeys(workspaceId);
  // Kept in page state only: the plain key is never in the query cache.
  const [issuedKey, setIssuedKey] = useState<IssuedApiKey | null>(null);

  const createApiKeyMutation = useCreateApiKey();
  const deleteApiKeyMutation = useDeleteApiKey();

  const handleCreate = async (name: string) => {
    if (!workspaceId) return;

    createApiKeyMutation.mutate(
      { projectId: workspaceId, name },
      {
        onSuccess: (issued) => setIssuedKey(issued),
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
        description={`Manage keys to authenticate your webhook requests for ${workspace.name}.`}
      />

      <div className="mt-8">
        <ApiKeysList
          keys={keys}
          isLoading={keysLoading}
          onCreateKey={handleCreate}
          onDeleteKey={handleDelete}
          isCreating={createApiKeyMutation.isPending}
          isDeleting={deleteApiKeyMutation.isPending}
          issuedKey={issuedKey}
          onDismissIssuedKey={() => setIssuedKey(null)}
        />
      </div>
    </main>
  );
}
