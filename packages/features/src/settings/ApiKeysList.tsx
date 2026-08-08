"use client";

import React, { useState } from "react";
import type { ApiKey } from "@senlo/core";
import { Card, Button } from "@senlo/ui";
import { Key, Copy, Check, Trash2, Plus } from "lucide-react";

export interface ApiKeysListProps {
  keys: ApiKey[];
  isLoading?: boolean;
  onCreateKey?: (name: string) => void;
  onDeleteKey?: (id: number) => void;
  isCreating?: boolean;
  isDeleting?: boolean;
}

export function ApiKeysList({
  keys,
  isLoading,
  onCreateKey,
  onDeleteKey,
  isCreating,
  isDeleting,
}: ApiKeysListProps) {
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    onCreateKey?.(newKeyName.trim());
    setNewKeyName("");
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Your Keys</h3>
        {isLoading ? (
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
                        {key.key.substring(0, 8)}...
                        {key.key.substring(key.key.length - 4)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.key)}
                        className="text-zinc-400 hover:text-zinc-600 transition-colors"
                        title="Copy to clipboard"
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
