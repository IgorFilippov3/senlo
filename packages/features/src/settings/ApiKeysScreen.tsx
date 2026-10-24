// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import type { IssuedApiKey } from "@senlo/core";
import { PageHeader } from "@senlo/ui";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "../data/api-keys";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { FormErrorBanner } from "../shared/FormErrorBanner";
import { useCurrentWorkspace } from "../workspaces/WorkspaceScope";
import { ApiKeysList } from "./ApiKeysList";

/** The workspace's API keys: create (the key shown once), delete after a confirmation. */
export function ApiKeysScreen() {
  const workspace = useCurrentWorkspace();
  const { data: keys = [], isLoading } = useApiKeys(workspace.id);
  // Kept in page state only: the plain key is never in the query cache.
  const [issuedKey, setIssuedKey] = useState<IssuedApiKey | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);

  const create = useCreateApiKey();
  const remove = useDeleteApiKey();

  const closeDelete = () => {
    remove.reset();
    setToDelete(null);
  };

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="API Keys"
        description={`Manage keys to authenticate your webhook requests for ${workspace.name}.`}
      />

      <div className="mt-8 space-y-4">
        <FormErrorBanner error={create.error ? `Failed to create API key: ${create.error.message}` : null} />
        <ApiKeysList
          keys={keys}
          isLoading={isLoading}
          onCreateKey={(name) =>
            create.mutate({ projectId: workspace.id, name }, { onSuccess: (issued) => setIssuedKey(issued) })
          }
          onDeleteKey={setToDelete}
          isCreating={create.isPending}
          isDeleting={remove.isPending}
          issuedKey={issuedKey}
          onDismissIssuedKey={() => setIssuedKey(null)}
        />
      </div>

      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={closeDelete}
        title="Delete API Key"
        description="Are you sure you want to delete this API key? Requests that use it will be refused. This action cannot be undone."
        confirmLabel="Delete Key"
        pendingLabel="Deleting..."
        isPending={remove.isPending}
        error={remove.error ? `Failed to delete API key: ${remove.error.message}` : null}
        onConfirm={() =>
          toDelete !== null &&
          remove.mutate({ apiKeyId: toDelete, projectId: workspace.id }, { onSuccess: closeDelete })
        }
      />
    </main>
  );
}
