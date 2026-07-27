"use client";

import { PageHeader, Button, Card } from "@senlo/ui";
import { Plus, Trash2, Key, Copy, Check } from "lucide-react";
import React, { useState } from "react";
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
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: keys = [], isLoading: keysLoading } = useApiKeys(
    workspaceId,
    !!workspaceId,
  );

  const createApiKeyMutation = useCreateApiKey();
  const deleteApiKeyMutation = useDeleteApiKey();

  const handleCreate = async () => {
    if (!workspaceId || !newKeyName) return;

    createApiKeyMutation.mutate(
      { projectId: workspaceId, name: newKeyName },
      {
        onSuccess: () => {
          setNewKeyName("");
        },
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

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <main className="max-w-7xl mx-auto py-10 px-8">
      <PageHeader
        title="API Keys"
        description={`Manage keys to authenticate your webhook requests for ${workspace?.name || "this workspace"}.`}
      />

      <div className="mt-8 space-y-8">
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Create New Key</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">
                Key Name
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Production Backend"
                className="w-full p-2 border rounded-md text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCreate}
                disabled={!newKeyName || createApiKeyMutation.isPending}
                className="gap-2"
              >
                <Plus size={16} />
                {createApiKeyMutation.isPending ? "Creating..." : "Create Key"}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Your Keys</h3>
          {keysLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <p className="text-zinc-500">Loading API keys...</p>
              </div>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-zinc-500">
              No API keys found for this workspace.
            </div>
          ) : (
            <div className="grid gap-4">
              {keys.map((key) => (
                <Card
                  key={key.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500">
                      <Key size={20} />
                    </div>
                    <div>
                      <div className="font-medium">{key.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded text-zinc-600">
                          {key.key.substring(0, 8)}...
                          {key.key.substring(key.key.length - 4)}
                        </code>
                        <button
                          onClick={() => copyToClipboard(key.key)}
                          className="text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          {copiedKey === key.key ? (
                            <Check size={14} className="text-green-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-xs text-zinc-400 uppercase font-medium">
                        Last Used
                      </div>
                      <div className="text-sm">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleDateString()
                          : "Never"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(key.id)}
                      disabled={deleteApiKeyMutation.isPending}
                      className="text-zinc-400 hover:text-red-600"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
