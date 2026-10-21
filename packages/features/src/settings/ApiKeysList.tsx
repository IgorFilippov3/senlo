"use client";

import React, { useState } from "react";
import type { ApiKey, IssuedApiKey } from "@senlo/core";
import { Card, Button } from "@senlo/ui";
import { Key, Copy, Check, Trash2, Plus, X } from "lucide-react";
import { LoadingState } from "../shared/Loading";

export interface ApiKeysListProps {
  keys: ApiKey[];
  isLoading?: boolean;
  onCreateKey?: (name: string) => void;
  onDeleteKey?: (id: number) => void;
  isCreating?: boolean;
  isDeleting?: boolean;
  /** The key just created, shown in full once; the list only ever has prefixes. */
  issuedKey?: IssuedApiKey | null;
  onDismissIssuedKey?: () => void;
}

function IssuedKeyNotice({ issued, onDismiss }: { issued: IssuedApiKey; onDismiss?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(issued.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3"
      role="status"
      data-testid="issued-api-key"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-amber-900">Copy your new key &ldquo;{issued.name}&rdquo; now</div>
          <div className="text-sm text-amber-800 mt-1">
            It is shown only this once. If you lose it, delete it and create a new one.
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-amber-700 hover:text-amber-900 transition-colors"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-sm bg-white border border-amber-200 px-3 py-2 rounded font-mono">
          {issued.key}
        </code>
        <Button onClick={copy} className="gap-2 shrink-0">
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function ApiKeysList({
  keys,
  isLoading,
  onCreateKey,
  onDeleteKey,
  isCreating,
  isDeleting,
  issuedKey,
  onDismissIssuedKey,
}: ApiKeysListProps) {
  const [newKeyName, setNewKeyName] = useState("");

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    onCreateKey?.(newKeyName.trim());
    setNewKeyName("");
  };

  return (
    <div className="space-y-8">
      <Card className="p-6 border-zinc-200 shadow-sm">
        <h3 className="text-lg font-medium mb-4">Create New Key</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-500 uppercase mb-1">
              Key Name
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. Production Backend"
              className="w-full p-2 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleCreate}
              disabled={!newKeyName.trim() || isCreating}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus size={16} />
              {isCreating ? "Creating..." : "Create Key"}
            </Button>
          </div>
        </div>
      </Card>

      {issuedKey && <IssuedKeyNotice issued={issuedKey} onDismiss={onDismissIssuedKey} />}

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Your Keys</h3>
        {isLoading ? (
          <LoadingState label="Loading API keys..." />
        ) : keys.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-zinc-500">
            No API keys found for this workspace.
          </div>
        ) : (
          <div className="grid gap-4">
            {keys.map((key) => (
              <Card
                key={key.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-zinc-200 shadow-sm hover:border-zinc-300 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 flex-shrink-0">
                    <Key size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{key.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-zinc-100 px-2 py-0.5 rounded text-zinc-600 font-mono">
                        {key.prefix}…
                      </code>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-6">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                      Last Used
                    </div>
                    <div className="text-sm text-zinc-600">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteKey?.(key.id)}
                    disabled={isDeleting}
                    className="text-zinc-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete key"
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
  );
}
